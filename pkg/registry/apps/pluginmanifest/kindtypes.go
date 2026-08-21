package pluginmanifest

// Distinct Go types, one handed out per (kind, version) an app serves.
//
// manifestObject alone is not enough. Operation IDs, and the GVK the REST installer
// registers a resource under, are both derived from the storage object's Go type via
// scheme.ObjectKinds. If every kind in an app shares one type, that lookup returns the
// same first-registered GVK for all of them, so a second kind reuses the first kind's
// operation IDs and the API server refuses to start with
// "duplicate Operation ID ...". Giving each kind its own type keeps the reverse lookup
// unambiguous.
//
// The types are indistinguishable apart from their names, so they are generated here
// rather than written out by hand. The pool is fixed-size because the types must exist at
// compile time; kinds beyond it fall back to the shared manifestObject, which works as
// long as an app serves no more than one such kind.

import (
	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime"
)

// manifestKindTypeCount is the number of distinct per-kind type pairs available.
const manifestKindTypeCount = 64

type manifestObject0 struct{ resource.UntypedObject }

func (o *manifestObject0) Copy() resource.Object {
	cpy := &manifestObject0{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject0) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList0 struct{ resource.UntypedList }

func (l *manifestList0) Copy() resource.ListObject {
	cpy := &manifestList0{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList0) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject1 struct{ resource.UntypedObject }

func (o *manifestObject1) Copy() resource.Object {
	cpy := &manifestObject1{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject1) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList1 struct{ resource.UntypedList }

func (l *manifestList1) Copy() resource.ListObject {
	cpy := &manifestList1{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList1) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject2 struct{ resource.UntypedObject }

func (o *manifestObject2) Copy() resource.Object {
	cpy := &manifestObject2{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject2) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList2 struct{ resource.UntypedList }

func (l *manifestList2) Copy() resource.ListObject {
	cpy := &manifestList2{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList2) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject3 struct{ resource.UntypedObject }

func (o *manifestObject3) Copy() resource.Object {
	cpy := &manifestObject3{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject3) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList3 struct{ resource.UntypedList }

func (l *manifestList3) Copy() resource.ListObject {
	cpy := &manifestList3{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList3) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject4 struct{ resource.UntypedObject }

func (o *manifestObject4) Copy() resource.Object {
	cpy := &manifestObject4{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject4) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList4 struct{ resource.UntypedList }

func (l *manifestList4) Copy() resource.ListObject {
	cpy := &manifestList4{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList4) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject5 struct{ resource.UntypedObject }

func (o *manifestObject5) Copy() resource.Object {
	cpy := &manifestObject5{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject5) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList5 struct{ resource.UntypedList }

func (l *manifestList5) Copy() resource.ListObject {
	cpy := &manifestList5{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList5) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject6 struct{ resource.UntypedObject }

func (o *manifestObject6) Copy() resource.Object {
	cpy := &manifestObject6{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject6) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList6 struct{ resource.UntypedList }

func (l *manifestList6) Copy() resource.ListObject {
	cpy := &manifestList6{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList6) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject7 struct{ resource.UntypedObject }

func (o *manifestObject7) Copy() resource.Object {
	cpy := &manifestObject7{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject7) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList7 struct{ resource.UntypedList }

func (l *manifestList7) Copy() resource.ListObject {
	cpy := &manifestList7{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList7) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject8 struct{ resource.UntypedObject }

func (o *manifestObject8) Copy() resource.Object {
	cpy := &manifestObject8{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject8) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList8 struct{ resource.UntypedList }

func (l *manifestList8) Copy() resource.ListObject {
	cpy := &manifestList8{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList8) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject9 struct{ resource.UntypedObject }

func (o *manifestObject9) Copy() resource.Object {
	cpy := &manifestObject9{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject9) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList9 struct{ resource.UntypedList }

func (l *manifestList9) Copy() resource.ListObject {
	cpy := &manifestList9{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList9) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject10 struct{ resource.UntypedObject }

func (o *manifestObject10) Copy() resource.Object {
	cpy := &manifestObject10{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject10) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList10 struct{ resource.UntypedList }

func (l *manifestList10) Copy() resource.ListObject {
	cpy := &manifestList10{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList10) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject11 struct{ resource.UntypedObject }

func (o *manifestObject11) Copy() resource.Object {
	cpy := &manifestObject11{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject11) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList11 struct{ resource.UntypedList }

func (l *manifestList11) Copy() resource.ListObject {
	cpy := &manifestList11{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList11) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject12 struct{ resource.UntypedObject }

func (o *manifestObject12) Copy() resource.Object {
	cpy := &manifestObject12{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject12) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList12 struct{ resource.UntypedList }

func (l *manifestList12) Copy() resource.ListObject {
	cpy := &manifestList12{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList12) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject13 struct{ resource.UntypedObject }

func (o *manifestObject13) Copy() resource.Object {
	cpy := &manifestObject13{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject13) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList13 struct{ resource.UntypedList }

func (l *manifestList13) Copy() resource.ListObject {
	cpy := &manifestList13{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList13) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject14 struct{ resource.UntypedObject }

func (o *manifestObject14) Copy() resource.Object {
	cpy := &manifestObject14{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject14) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList14 struct{ resource.UntypedList }

func (l *manifestList14) Copy() resource.ListObject {
	cpy := &manifestList14{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList14) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject15 struct{ resource.UntypedObject }

func (o *manifestObject15) Copy() resource.Object {
	cpy := &manifestObject15{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject15) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList15 struct{ resource.UntypedList }

func (l *manifestList15) Copy() resource.ListObject {
	cpy := &manifestList15{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList15) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject16 struct{ resource.UntypedObject }

func (o *manifestObject16) Copy() resource.Object {
	cpy := &manifestObject16{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject16) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList16 struct{ resource.UntypedList }

func (l *manifestList16) Copy() resource.ListObject {
	cpy := &manifestList16{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList16) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject17 struct{ resource.UntypedObject }

func (o *manifestObject17) Copy() resource.Object {
	cpy := &manifestObject17{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject17) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList17 struct{ resource.UntypedList }

func (l *manifestList17) Copy() resource.ListObject {
	cpy := &manifestList17{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList17) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject18 struct{ resource.UntypedObject }

func (o *manifestObject18) Copy() resource.Object {
	cpy := &manifestObject18{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject18) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList18 struct{ resource.UntypedList }

func (l *manifestList18) Copy() resource.ListObject {
	cpy := &manifestList18{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList18) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject19 struct{ resource.UntypedObject }

func (o *manifestObject19) Copy() resource.Object {
	cpy := &manifestObject19{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject19) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList19 struct{ resource.UntypedList }

func (l *manifestList19) Copy() resource.ListObject {
	cpy := &manifestList19{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList19) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject20 struct{ resource.UntypedObject }

func (o *manifestObject20) Copy() resource.Object {
	cpy := &manifestObject20{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject20) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList20 struct{ resource.UntypedList }

func (l *manifestList20) Copy() resource.ListObject {
	cpy := &manifestList20{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList20) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject21 struct{ resource.UntypedObject }

func (o *manifestObject21) Copy() resource.Object {
	cpy := &manifestObject21{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject21) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList21 struct{ resource.UntypedList }

func (l *manifestList21) Copy() resource.ListObject {
	cpy := &manifestList21{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList21) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject22 struct{ resource.UntypedObject }

func (o *manifestObject22) Copy() resource.Object {
	cpy := &manifestObject22{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject22) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList22 struct{ resource.UntypedList }

func (l *manifestList22) Copy() resource.ListObject {
	cpy := &manifestList22{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList22) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject23 struct{ resource.UntypedObject }

func (o *manifestObject23) Copy() resource.Object {
	cpy := &manifestObject23{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject23) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList23 struct{ resource.UntypedList }

func (l *manifestList23) Copy() resource.ListObject {
	cpy := &manifestList23{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList23) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject24 struct{ resource.UntypedObject }

func (o *manifestObject24) Copy() resource.Object {
	cpy := &manifestObject24{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject24) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList24 struct{ resource.UntypedList }

func (l *manifestList24) Copy() resource.ListObject {
	cpy := &manifestList24{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList24) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject25 struct{ resource.UntypedObject }

func (o *manifestObject25) Copy() resource.Object {
	cpy := &manifestObject25{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject25) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList25 struct{ resource.UntypedList }

func (l *manifestList25) Copy() resource.ListObject {
	cpy := &manifestList25{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList25) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject26 struct{ resource.UntypedObject }

func (o *manifestObject26) Copy() resource.Object {
	cpy := &manifestObject26{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject26) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList26 struct{ resource.UntypedList }

func (l *manifestList26) Copy() resource.ListObject {
	cpy := &manifestList26{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList26) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject27 struct{ resource.UntypedObject }

func (o *manifestObject27) Copy() resource.Object {
	cpy := &manifestObject27{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject27) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList27 struct{ resource.UntypedList }

func (l *manifestList27) Copy() resource.ListObject {
	cpy := &manifestList27{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList27) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject28 struct{ resource.UntypedObject }

func (o *manifestObject28) Copy() resource.Object {
	cpy := &manifestObject28{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject28) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList28 struct{ resource.UntypedList }

func (l *manifestList28) Copy() resource.ListObject {
	cpy := &manifestList28{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList28) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject29 struct{ resource.UntypedObject }

func (o *manifestObject29) Copy() resource.Object {
	cpy := &manifestObject29{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject29) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList29 struct{ resource.UntypedList }

func (l *manifestList29) Copy() resource.ListObject {
	cpy := &manifestList29{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList29) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject30 struct{ resource.UntypedObject }

func (o *manifestObject30) Copy() resource.Object {
	cpy := &manifestObject30{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject30) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList30 struct{ resource.UntypedList }

func (l *manifestList30) Copy() resource.ListObject {
	cpy := &manifestList30{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList30) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject31 struct{ resource.UntypedObject }

func (o *manifestObject31) Copy() resource.Object {
	cpy := &manifestObject31{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject31) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList31 struct{ resource.UntypedList }

func (l *manifestList31) Copy() resource.ListObject {
	cpy := &manifestList31{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList31) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject32 struct{ resource.UntypedObject }

func (o *manifestObject32) Copy() resource.Object {
	cpy := &manifestObject32{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject32) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList32 struct{ resource.UntypedList }

func (l *manifestList32) Copy() resource.ListObject {
	cpy := &manifestList32{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList32) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject33 struct{ resource.UntypedObject }

func (o *manifestObject33) Copy() resource.Object {
	cpy := &manifestObject33{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject33) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList33 struct{ resource.UntypedList }

func (l *manifestList33) Copy() resource.ListObject {
	cpy := &manifestList33{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList33) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject34 struct{ resource.UntypedObject }

func (o *manifestObject34) Copy() resource.Object {
	cpy := &manifestObject34{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject34) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList34 struct{ resource.UntypedList }

func (l *manifestList34) Copy() resource.ListObject {
	cpy := &manifestList34{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList34) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject35 struct{ resource.UntypedObject }

func (o *manifestObject35) Copy() resource.Object {
	cpy := &manifestObject35{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject35) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList35 struct{ resource.UntypedList }

func (l *manifestList35) Copy() resource.ListObject {
	cpy := &manifestList35{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList35) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject36 struct{ resource.UntypedObject }

func (o *manifestObject36) Copy() resource.Object {
	cpy := &manifestObject36{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject36) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList36 struct{ resource.UntypedList }

func (l *manifestList36) Copy() resource.ListObject {
	cpy := &manifestList36{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList36) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject37 struct{ resource.UntypedObject }

func (o *manifestObject37) Copy() resource.Object {
	cpy := &manifestObject37{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject37) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList37 struct{ resource.UntypedList }

func (l *manifestList37) Copy() resource.ListObject {
	cpy := &manifestList37{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList37) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject38 struct{ resource.UntypedObject }

func (o *manifestObject38) Copy() resource.Object {
	cpy := &manifestObject38{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject38) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList38 struct{ resource.UntypedList }

func (l *manifestList38) Copy() resource.ListObject {
	cpy := &manifestList38{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList38) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject39 struct{ resource.UntypedObject }

func (o *manifestObject39) Copy() resource.Object {
	cpy := &manifestObject39{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject39) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList39 struct{ resource.UntypedList }

func (l *manifestList39) Copy() resource.ListObject {
	cpy := &manifestList39{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList39) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject40 struct{ resource.UntypedObject }

func (o *manifestObject40) Copy() resource.Object {
	cpy := &manifestObject40{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject40) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList40 struct{ resource.UntypedList }

func (l *manifestList40) Copy() resource.ListObject {
	cpy := &manifestList40{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList40) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject41 struct{ resource.UntypedObject }

func (o *manifestObject41) Copy() resource.Object {
	cpy := &manifestObject41{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject41) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList41 struct{ resource.UntypedList }

func (l *manifestList41) Copy() resource.ListObject {
	cpy := &manifestList41{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList41) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject42 struct{ resource.UntypedObject }

func (o *manifestObject42) Copy() resource.Object {
	cpy := &manifestObject42{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject42) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList42 struct{ resource.UntypedList }

func (l *manifestList42) Copy() resource.ListObject {
	cpy := &manifestList42{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList42) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject43 struct{ resource.UntypedObject }

func (o *manifestObject43) Copy() resource.Object {
	cpy := &manifestObject43{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject43) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList43 struct{ resource.UntypedList }

func (l *manifestList43) Copy() resource.ListObject {
	cpy := &manifestList43{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList43) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject44 struct{ resource.UntypedObject }

func (o *manifestObject44) Copy() resource.Object {
	cpy := &manifestObject44{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject44) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList44 struct{ resource.UntypedList }

func (l *manifestList44) Copy() resource.ListObject {
	cpy := &manifestList44{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList44) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject45 struct{ resource.UntypedObject }

func (o *manifestObject45) Copy() resource.Object {
	cpy := &manifestObject45{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject45) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList45 struct{ resource.UntypedList }

func (l *manifestList45) Copy() resource.ListObject {
	cpy := &manifestList45{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList45) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject46 struct{ resource.UntypedObject }

func (o *manifestObject46) Copy() resource.Object {
	cpy := &manifestObject46{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject46) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList46 struct{ resource.UntypedList }

func (l *manifestList46) Copy() resource.ListObject {
	cpy := &manifestList46{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList46) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject47 struct{ resource.UntypedObject }

func (o *manifestObject47) Copy() resource.Object {
	cpy := &manifestObject47{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject47) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList47 struct{ resource.UntypedList }

func (l *manifestList47) Copy() resource.ListObject {
	cpy := &manifestList47{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList47) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject48 struct{ resource.UntypedObject }

func (o *manifestObject48) Copy() resource.Object {
	cpy := &manifestObject48{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject48) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList48 struct{ resource.UntypedList }

func (l *manifestList48) Copy() resource.ListObject {
	cpy := &manifestList48{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList48) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject49 struct{ resource.UntypedObject }

func (o *manifestObject49) Copy() resource.Object {
	cpy := &manifestObject49{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject49) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList49 struct{ resource.UntypedList }

func (l *manifestList49) Copy() resource.ListObject {
	cpy := &manifestList49{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList49) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject50 struct{ resource.UntypedObject }

func (o *manifestObject50) Copy() resource.Object {
	cpy := &manifestObject50{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject50) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList50 struct{ resource.UntypedList }

func (l *manifestList50) Copy() resource.ListObject {
	cpy := &manifestList50{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList50) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject51 struct{ resource.UntypedObject }

func (o *manifestObject51) Copy() resource.Object {
	cpy := &manifestObject51{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject51) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList51 struct{ resource.UntypedList }

func (l *manifestList51) Copy() resource.ListObject {
	cpy := &manifestList51{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList51) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject52 struct{ resource.UntypedObject }

func (o *manifestObject52) Copy() resource.Object {
	cpy := &manifestObject52{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject52) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList52 struct{ resource.UntypedList }

func (l *manifestList52) Copy() resource.ListObject {
	cpy := &manifestList52{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList52) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject53 struct{ resource.UntypedObject }

func (o *manifestObject53) Copy() resource.Object {
	cpy := &manifestObject53{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject53) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList53 struct{ resource.UntypedList }

func (l *manifestList53) Copy() resource.ListObject {
	cpy := &manifestList53{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList53) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject54 struct{ resource.UntypedObject }

func (o *manifestObject54) Copy() resource.Object {
	cpy := &manifestObject54{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject54) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList54 struct{ resource.UntypedList }

func (l *manifestList54) Copy() resource.ListObject {
	cpy := &manifestList54{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList54) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject55 struct{ resource.UntypedObject }

func (o *manifestObject55) Copy() resource.Object {
	cpy := &manifestObject55{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject55) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList55 struct{ resource.UntypedList }

func (l *manifestList55) Copy() resource.ListObject {
	cpy := &manifestList55{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList55) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject56 struct{ resource.UntypedObject }

func (o *manifestObject56) Copy() resource.Object {
	cpy := &manifestObject56{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject56) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList56 struct{ resource.UntypedList }

func (l *manifestList56) Copy() resource.ListObject {
	cpy := &manifestList56{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList56) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject57 struct{ resource.UntypedObject }

func (o *manifestObject57) Copy() resource.Object {
	cpy := &manifestObject57{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject57) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList57 struct{ resource.UntypedList }

func (l *manifestList57) Copy() resource.ListObject {
	cpy := &manifestList57{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList57) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject58 struct{ resource.UntypedObject }

func (o *manifestObject58) Copy() resource.Object {
	cpy := &manifestObject58{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject58) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList58 struct{ resource.UntypedList }

func (l *manifestList58) Copy() resource.ListObject {
	cpy := &manifestList58{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList58) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject59 struct{ resource.UntypedObject }

func (o *manifestObject59) Copy() resource.Object {
	cpy := &manifestObject59{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject59) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList59 struct{ resource.UntypedList }

func (l *manifestList59) Copy() resource.ListObject {
	cpy := &manifestList59{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList59) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject60 struct{ resource.UntypedObject }

func (o *manifestObject60) Copy() resource.Object {
	cpy := &manifestObject60{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject60) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList60 struct{ resource.UntypedList }

func (l *manifestList60) Copy() resource.ListObject {
	cpy := &manifestList60{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList60) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject61 struct{ resource.UntypedObject }

func (o *manifestObject61) Copy() resource.Object {
	cpy := &manifestObject61{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject61) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList61 struct{ resource.UntypedList }

func (l *manifestList61) Copy() resource.ListObject {
	cpy := &manifestList61{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList61) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject62 struct{ resource.UntypedObject }

func (o *manifestObject62) Copy() resource.Object {
	cpy := &manifestObject62{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject62) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList62 struct{ resource.UntypedList }

func (l *manifestList62) Copy() resource.ListObject {
	cpy := &manifestList62{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList62) DeepCopyObject() runtime.Object { return l.Copy() }

type manifestObject63 struct{ resource.UntypedObject }

func (o *manifestObject63) Copy() resource.Object {
	cpy := &manifestObject63{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject63) DeepCopyObject() runtime.Object { return o.Copy() }

type manifestList63 struct{ resource.UntypedList }

func (l *manifestList63) Copy() resource.ListObject {
	cpy := &manifestList63{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList63) DeepCopyObject() runtime.Object { return l.Copy() }

// manifestObjectFactories returns a fresh object/list pair for slot i.
var manifestObjectFactories = []func() (resource.Object, resource.ListObject){
	func() (resource.Object, resource.ListObject) { return &manifestObject0{}, &manifestList0{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject1{}, &manifestList1{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject2{}, &manifestList2{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject3{}, &manifestList3{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject4{}, &manifestList4{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject5{}, &manifestList5{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject6{}, &manifestList6{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject7{}, &manifestList7{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject8{}, &manifestList8{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject9{}, &manifestList9{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject10{}, &manifestList10{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject11{}, &manifestList11{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject12{}, &manifestList12{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject13{}, &manifestList13{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject14{}, &manifestList14{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject15{}, &manifestList15{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject16{}, &manifestList16{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject17{}, &manifestList17{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject18{}, &manifestList18{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject19{}, &manifestList19{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject20{}, &manifestList20{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject21{}, &manifestList21{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject22{}, &manifestList22{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject23{}, &manifestList23{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject24{}, &manifestList24{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject25{}, &manifestList25{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject26{}, &manifestList26{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject27{}, &manifestList27{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject28{}, &manifestList28{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject29{}, &manifestList29{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject30{}, &manifestList30{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject31{}, &manifestList31{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject32{}, &manifestList32{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject33{}, &manifestList33{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject34{}, &manifestList34{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject35{}, &manifestList35{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject36{}, &manifestList36{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject37{}, &manifestList37{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject38{}, &manifestList38{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject39{}, &manifestList39{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject40{}, &manifestList40{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject41{}, &manifestList41{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject42{}, &manifestList42{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject43{}, &manifestList43{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject44{}, &manifestList44{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject45{}, &manifestList45{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject46{}, &manifestList46{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject47{}, &manifestList47{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject48{}, &manifestList48{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject49{}, &manifestList49{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject50{}, &manifestList50{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject51{}, &manifestList51{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject52{}, &manifestList52{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject53{}, &manifestList53{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject54{}, &manifestList54{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject55{}, &manifestList55{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject56{}, &manifestList56{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject57{}, &manifestList57{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject58{}, &manifestList58{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject59{}, &manifestList59{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject60{}, &manifestList60{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject61{}, &manifestList61{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject62{}, &manifestList62{} },
	func() (resource.Object, resource.ListObject) { return &manifestObject63{}, &manifestList63{} },
}

// newManifestKindTypes returns the object/list pair for slot i.
//
// Past the end of the pool it falls back to the shared manifestObject/manifestList. That
// keeps an app with an unusually large number of kinds working for every kind up to the
// limit, rather than failing outright, though any kinds sharing the fallback would still
// collide with each other.
func newManifestKindTypes(i int) (resource.Object, resource.ListObject) {
	if i < 0 || i >= manifestKindTypeCount {
		return &manifestObject{}, &manifestList{}
	}
	return manifestObjectFactories[i]()
}
