package client

import (
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/cache"
)

type Resource interface {
	dynamic.ResourceInterface
	cache.SharedIndexInformer
}
