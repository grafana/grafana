package builder

import (
	"reflect"
	"testing"

	genericapiserver "k8s.io/apiserver/pkg/server"
)

// These tests catch k8s upstream drift that would otherwise only surface at
// apiserver startup. They cover the reflection assumptions in
// custom_handler_chain.go — if any of them fail after a k8s bump, update
// custom_handler_chain.go to match the new shape.

func TestLifecycleSignalsFieldAccessible(t *testing.T) {
	c := &genericapiserver.Config{}
	field := reflect.ValueOf(c).Elem().FieldByName("lifecycleSignals")
	if !field.IsValid() {
		t.Fatal(`genericapiserver.Config has no "lifecycleSignals" field — upstream may have renamed or refactored it; update custom_handler_chain.go`)
	}
}

func TestLifecycleSignalsExpectedSubfields(t *testing.T) {
	c := &genericapiserver.Config{}
	sigs := reflect.ValueOf(c).Elem().FieldByName("lifecycleSignals")
	for _, name := range []string{"MuxAndDiscoveryComplete", "NotAcceptingNewRequest"} {
		if !sigs.FieldByName(name).IsValid() {
			t.Fatalf(`genericapiserver.Config.lifecycleSignals has no %q subfield — upstream rename?; update custom_handler_chain.go`, name)
		}
	}
}

func TestLifecycleSignalSignaledMethodExists(t *testing.T) {
	c := &genericapiserver.Config{}
	sigs := reflect.ValueOf(c).Elem().FieldByName("lifecycleSignals")
	sub := sigs.FieldByName("MuxAndDiscoveryComplete")
	if !sub.MethodByName("Signaled").IsValid() {
		t.Fatal(`lifecycleSignal type has no "Signaled" method — upstream API change; update custom_handler_chain.go`)
	}
}
