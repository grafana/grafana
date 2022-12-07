package mtctx

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

func TestKubeAccess(t *testing.T) {
	t.Skip()

	kubeconfig := "/Users/ryan/.kube/config"
	config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	require.NoError(t, err)

	client, err := kubernetes.NewForConfig(config)
	require.NoError(t, err)

	out, err := client.CoreV1().ConfigMaps("default").Get(context.TODO(), "123-mt-config", metav1.GetOptions{})
	require.NoError(t, err)

	fmt.Printf("%v", out)

	t.FailNow() // shows logs
}
