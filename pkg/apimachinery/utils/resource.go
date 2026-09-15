package utils

import (
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// ResourceInfo helps define a k8s resource
type ResourceInfo struct {
	group         string
	version       string
	resourceName  string
	singularName  string
	shortName     string
	kind          string
	newObj        func() runtime.Object
	newList       func() runtime.Object
	columns       TableColumns
	clusterScoped bool
}

func NewResourceInfo(group, version, resourceName, singularName, kind string,
	newObjBasic func() runtime.Object, newListBasic func() runtime.Object, columns TableColumns) ResourceInfo {
	shortName := ""        // an optional alias helpful in kubectl eg ("sa" for serviceaccounts)
	clusterScoped := false // if true, this resource is cluster scoped, otherwise it is namespace scoped

	gvkObj := schema.GroupVersionKind{Group: group, Version: version, Kind: kind}
	gvkLst := schema.GroupVersionKind{Group: group, Version: version, Kind: kind + "List"}

	newObj := func() runtime.Object {
		v := newObjBasic()
		v.GetObjectKind().SetGroupVersionKind(gvkObj)
		return v
	}

	newList := func() runtime.Object {
		v := newListBasic()
		v.GetObjectKind().SetGroupVersionKind(gvkLst)
		return v
	}

	return ResourceInfo{group, version, resourceName, singularName, shortName, kind, newObj, newList, columns, clusterScoped}
}

func (info *ResourceInfo) WithGroupAndShortName(group string, shortName string) ResourceInfo {
	copy := NewResourceInfo(group, info.version, info.resourceName, info.singularName, info.kind, info.newObj, info.newList, info.columns)
	copy.shortName = shortName
	return copy
}

func (info *ResourceInfo) WithClusterScope() ResourceInfo {
	info.clusterScoped = true
	return *info
}

func (info *ResourceInfo) IsClusterScoped() bool {
	return info.clusterScoped
}

func (info *ResourceInfo) GetName() string {
	return info.resourceName
}

func (info *ResourceInfo) GetSingularName() string {
	return info.singularName
}

func (info *ResourceInfo) GetShortNames() []string {
	if info.shortName == "" {
		return []string{}
	}
	return []string{info.shortName}
}

// TypeMeta returns k8s type
func (info *ResourceInfo) TypeMeta() metav1.TypeMeta {
	return metav1.TypeMeta{
		Kind:       info.kind,
		APIVersion: info.group + "/" + info.version,
	}
}

func (info *ResourceInfo) GroupVersion() schema.GroupVersion {
	return schema.GroupVersion{
		Group:   info.group,
		Version: info.version,
	}
}

func (info *ResourceInfo) GroupResource() schema.GroupResource {
	return schema.GroupResource{
		Group:    info.group,
		Resource: info.resourceName,
	}
}

func (info *ResourceInfo) GroupVersionKind() schema.GroupVersionKind {
	return schema.GroupVersionKind{
		Group:   info.group,
		Version: info.version,
		Kind:    info.kind,
	}
}

func (info *ResourceInfo) SingularGroupResource() schema.GroupResource {
	return schema.GroupResource{
		Group:    info.group,
		Resource: info.singularName,
	}
}

func (info *ResourceInfo) GroupVersionResource() schema.GroupVersionResource {
	return schema.GroupVersionResource{
		Group:    info.group,
		Version:  info.version,
		Resource: info.resourceName,
	}
}

func (info *ResourceInfo) StoragePath(sub ...string) string {
	switch len(sub) {
	case 0:
		return info.resourceName
	case 1:
		return info.resourceName + "/" + sub[0]
	}
	panic("invalid subresource path")
}

func (info *ResourceInfo) NewFunc() runtime.Object {
	return info.newObj()
}

func (info *ResourceInfo) NewListFunc() runtime.Object {
	return info.newList()
}

func (info *ResourceInfo) TableConverter() TableConvertor {
	return NewTableConverter(info.GroupResource(), info.columns)
}

func (info *ResourceInfo) NewNotFound(name string) *errors.StatusError {
	return errors.NewNotFound(info.SingularGroupResource(), name)
}
