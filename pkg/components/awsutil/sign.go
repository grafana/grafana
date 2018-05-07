package awsutil

import (
	"bytes"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go/aws/ec2metadata"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/aws/signer/v4"
)

var signer *v4.Signer

func init() {
	sess := session.Must(session.NewSession())
	creds := credentials.NewChainCredentials(
		[]credentials.Provider{
			&credentials.EnvProvider{},
			&credentials.SharedCredentialsProvider{Filename: "", Profile: ""},
			&ec2rolecreds.EC2RoleProvider{Client: ec2metadata.New(sess), ExpiryWindow: 5 * time.Minute},
		})
	signer = v4.NewSigner(creds)
}

func getServiceAndRegion(targetUrl *url.URL) (service string, region string) {
	hostname := targetUrl.Hostname()
	hsPart := strings.Split(hostname, ".")

	if len(hsPart) == 4 && hsPart[2] == "amazonaws" && hsPart[3] == "com" {
		// http://docs.aws.amazon.com/general/latest/gr/rande.html
		service = hsPart[0]
		region = hsPart[1]
	} else if len(hsPart) == 5 && hsPart[3] == "amazonaws" && hsPart[4] == "com" {
		if hsPart[2] == "es" {
			// Elasticsearch
			// http://docs.aws.amazon.com/elasticsearch-service/latest/developerguide/what-is-amazon-elasticsearch-service.html#endpoints
			service = hsPart[2]
			region = hsPart[1]
		} else {
			// API Gateway, etc...
			// http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-create-api-from-example.html
			service = hsPart[1]
			region = hsPart[2]
		}
	}

	return service, region
}

func SignV4(req *http.Request, targetUrl *url.URL) {
	service, region := getServiceAndRegion(targetUrl)
	if service == "" || region == "" {
		return
	}

	var body []byte
	if req.Body != nil {
		body, _ = ioutil.ReadAll(req.Body)
	}
	now := time.Now()

	// exclude X-Forwarded-For/Connection from sign target, it could be modified after send
	xff := req.Header.Get("X-Forwarded-For")
	conn := req.Header.Get("Connection")
	req.Header.Del("X-Forwarded-For")
	req.Header.Del("Connection")
	awsHeader, err := signer.Sign(req, bytes.NewReader(body), service, region, now)
	req.Header.Set("X-Forwarded-For", xff)
	req.Header.Set("Connection", conn)

	if err != nil {
		return
	}

	for key, vals := range awsHeader {
		for _, val := range vals {
			req.Header.Del(key)
			req.Header.Add(key, val)
		}
	}
}
