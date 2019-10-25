package social

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type OpenIDConfig struct {
	JwksUri string `json:"jwks_uri"`
}

type JwksKey struct {
	Kid string   `json:"kid"`
	X5c []string `json:"x5c"`
}

type Jwks struct {
	Keys []JwksKey `json:"keys"`
}

func NewJwks(client *http.Client, uri string) (Jwks, error) {
	var j Jwks

	response, err := HttpGet(client, uri)
	if err != nil {
		return j, fmt.Errorf("Error getting jwks: %s", err)
	}

	err = json.Unmarshal(response.Body, &j)
	if err != nil {
		return j, fmt.Errorf("Error getting jwks: %s", err)
	}

	return j, nil
}

func (j *Jwks) GetCertForKid(kid string) string {
	var certs []string

	for i, k := range j.Keys {
		if k.Kid == kid {
			cert := fmt.Sprintf("-----BEGIN CERTIFICATE-----\n%s\n-----END CERTIFICATE-----", k.X5c[i])
			certs = append(certs, cert)
		}
	}

	return strings.Join(certs, "\n")
}

func NewOpenIDConfig(client *http.Client, wellKnownUrl string) (OpenIDConfig, error) {
	var o OpenIDConfig

	response, err := HttpGet(client, wellKnownUrl)

	err = json.Unmarshal(response.Body, &o)
	if err != nil {
		return o, fmt.Errorf("Error getting openid well knwon configuration: %s", err)
	}

	return o, nil
}

func (t *Token) getJwksUri() (string, error) {
	var wellKnwon struct {
		JwksUri string `json:"jwks_uri"`
	}

	response, err := HttpGet(http.DefaultClient, t.wellKnownUrl)

	err = json.Unmarshal(response.Body, &wellKnwon)
	if err != nil {
		return "", fmt.Errorf("Error getting openid well knwon configuration: %s", err)
	}

	return wellKnwon.JwksUri, nil
}
