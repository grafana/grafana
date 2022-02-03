package components

import "k8s.io/apimachinery/pkg/runtime/schema"

var GroupName = "grafana.com"

var SchemeGroupVersion = schema.GroupVersion{Group: GroupName, Version: "v1"}
