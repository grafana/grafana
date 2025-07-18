package controller

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
)

type Mutator func(ctx context.Context, obj runtime.Object) error
