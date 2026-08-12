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
	newObj func() runtime.Object, newList func() runtime.Object, columns TableColumns) ResourceInfo {
	shortName := ""        // an optional alias helpful in kubectl eg ("sa" for serviceaccounts)
	clusterScoped := false // if true, this resource is cluster scoped, otherwise it is namespace scoped
	return ResourceInfo{group, version, resourceName, singularName, shortName, kind, newObj, newList, columns, clusterScoped}
}

func (info *ResourceInfo) WithGroupAndShortName(group string, shortName string) ResourceInfo {
	return ResourceInfo{
		group:         group,
		version:       info.version,
		resourceName:  info.resourceName,
		singularName:  info.singularName,
		kind:          info.kind,
		shortName:     shortName,
		newObj:        info.newObj,
		newList:       info.newList,
		columns:       info.columns,
		clusterScoped: info.clusterScoped,
	}
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
