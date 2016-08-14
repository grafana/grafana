package route53_test

import (
	"bytes"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/awstesting/unit"
	"github.com/aws/aws-sdk-go/service/route53"
)

func makeClientWithResponse(response string) *route53.Route53 {
	r := route53.New(unit.Session)
	r.Handlers.Send.Clear()
	r.Handlers.Send.PushBack(func(r *request.Request) {
		body := ioutil.NopCloser(bytes.NewReader([]byte(response)))
		r.HTTPResponse = &http.Response{
			ContentLength: int64(len(response)),
			StatusCode:    400,
			Status:        "Bad Request",
			Body:          body,
		}
	})

	return r
}

func TestUnmarshalStandardError(t *testing.T) {
	const errorResponse = `<?xml version="1.0" encoding="UTF-8"?>
<ErrorResponse xmlns="https://route53.amazonaws.com/doc/2013-04-01/">
  <Error>
    <Code>InvalidDomainName</Code>
    <Message>The domain name is invalid</Message>
  </Error>
  <RequestId>12345</RequestId>
</ErrorResponse>
`

	r := makeClientWithResponse(errorResponse)

	_, err := r.CreateHostedZone(&route53.CreateHostedZoneInput{
		CallerReference: aws.String("test"),
		Name:            aws.String("test_zone"),
	})

	assert.Error(t, err)
	assert.Equal(t, "InvalidDomainName", err.(awserr.Error).Code())
	assert.Equal(t, "The domain name is invalid", err.(awserr.Error).Message())
}

func TestUnmarshalInvalidChangeBatch(t *testing.T) {
	const errorMessage = `
Tried to create resource record set duplicate.example.com. type A,
but it already exists
`
	const errorResponse = `<?xml version="1.0" encoding="UTF-8"?>
<InvalidChangeBatch xmlns="https://route53.amazonaws.com/doc/2013-04-01/">
  <Messages>
    <Message>` + errorMessage + `</Message>
  </Messages>
</InvalidChangeBatch>
`

	r := makeClientWithResponse(errorResponse)

	req := &route53.ChangeResourceRecordSetsInput{
		HostedZoneId: aws.String("zoneId"),
		ChangeBatch: &route53.ChangeBatch{
			Changes: []*route53.Change{
				{
					Action: aws.String("CREATE"),
					ResourceRecordSet: &route53.ResourceRecordSet{
						Name: aws.String("domain"),
						Type: aws.String("CNAME"),
						TTL:  aws.Int64(120),
						ResourceRecords: []*route53.ResourceRecord{
							{
								Value: aws.String("cname"),
							},
						},
					},
				},
			},
		},
	}

	_, err := r.ChangeResourceRecordSets(req)
	assert.Error(t, err)

	if reqErr, ok := err.(awserr.RequestFailure); ok {
		assert.Error(t, reqErr)
		assert.Equal(t, 400, reqErr.StatusCode())
	} else {
		assert.Fail(t, "returned error is not a RequestFailure")
	}

	if batchErr, ok := err.(awserr.BatchedErrors); ok {
		errs := batchErr.OrigErrs()
		assert.Len(t, errs, 1)
		assert.Equal(t, "InvalidChangeBatch", errs[0].(awserr.Error).Code())
		assert.Equal(t, errorMessage, errs[0].(awserr.Error).Message())
	} else {
		assert.Fail(t, "returned error is not a BatchedErrors")
	}
}
