package zanzana

import (
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

// FIXME(kalleep): Build out our wrapper client for openFGA
type Client struct {
	c openfgav1.OpenFGAServiceClient
}

func NewClient(c openfgav1.OpenFGAServiceClient) *Client {
	return &Client{c}
}

type NoopClient struct{}
