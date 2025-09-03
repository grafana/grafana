package controller

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	provisioningfake "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	provisioninginformers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
)

func TestJobController_New(t *testing.T) {
	client := provisioningfake.NewSimpleClientset()
	informerFactory := provisioninginformers.NewSharedInformerFactory(client, time.Second)
	jobInformer := informerFactory.Provisioning().V0alpha1().Jobs()

	controller, err := NewJobController(jobInformer)

	require.NoError(t, err)
	assert.NotNil(t, controller)
	assert.NotNil(t, controller.notifications)
}

func TestJobController_InsertNotifications(t *testing.T) {
	client := provisioningfake.NewSimpleClientset()
	informerFactory := provisioninginformers.NewSharedInformerFactory(client, time.Second)
	jobInformer := informerFactory.Provisioning().V0alpha1().Jobs()

	controller, err := NewJobController(jobInformer)
	require.NoError(t, err)

	notifications := controller.InsertNotifications()
	assert.NotNil(t, notifications)

	// Test that notification is sent
	controller.sendNotification()

	select {
	case <-notifications:
		// Success - notification received
	case <-time.After(time.Second):
		t.Fatal("Expected notification but didn't receive one")
	}
}

func TestJobController_NotificationOnJobCreate(t *testing.T) {
	client := provisioningfake.NewSimpleClientset()
	informerFactory := provisioninginformers.NewSharedInformerFactory(client, time.Second)
	jobInformer := informerFactory.Provisioning().V0alpha1().Jobs()

	controller, err := NewJobController(jobInformer)
	require.NoError(t, err)

	// Start informer and wait for cache sync
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()

	informerFactory.Start(ctx.Done())
	informerFactory.WaitForCacheSync(ctx.Done())

	// Get notifications channel
	notifications := controller.InsertNotifications()

	// Create a job - this should trigger a notification
	_, err = client.ProvisioningV0alpha1().Jobs("default").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "default",
		},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	// Wait for notification
	select {
	case <-notifications:
		// Success - notification received
	case <-time.After(time.Second * 2):
		t.Fatal("Expected notification but didn't receive one")
	}
}
