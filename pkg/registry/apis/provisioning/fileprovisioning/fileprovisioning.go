// SPDX-License-Identifier: AGPL-3.0-only

package fileprovisioning

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"go.yaml.in/yaml/v3"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
)

const (
	DefaultDirectory = "repositories"
	DefaultNamespace = "default"
)

// Provision loads Repository and Connection resources from YAML files and
// creates or updates them through the provisioning API. It intentionally uses
// the same v0alpha1 resources as the public as-code API so file provisioning
// and gcx/configuration-as-code cannot drift into separate representations.
func Provision(ctx context.Context, directory string, client client.ProvisioningV0alpha1Interface) error {
	if directory == "" {
		return nil
	}

	entries, err := os.ReadDir(directory)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("read repository provisioning directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || !isYAMLFile(entry.Name()) {
			continue
		}
		if err := provisionFile(ctx, filepath.Join(directory, entry.Name()), client); err != nil {
			return fmt.Errorf("provision %s: %w", entry.Name(), err)
		}
	}

	return nil
}

func provisionFile(ctx context.Context, filename string, client client.ProvisioningV0alpha1Interface) error {
	data, err := os.ReadFile(filename)
	if err != nil {
		return err
	}

	decoder := yaml.NewDecoder(strings.NewReader(string(data)))
	for document := 1; ; document++ {
		var node yaml.Node
		if err := decoder.Decode(&node); err != nil {
			if err == io.EOF {
				return nil
			}
			return fmt.Errorf("decode YAML document %d: %w", document, err)
		}
		if node.Kind == 0 {
			continue
		}

		// Expand environment variables after YAML parsing. Expanding the raw file
		// first can inject newlines into block structure and corrupt multiline
		// secrets such as PEM-encoded private keys.
		expandEnvironmentNode(&node)

		kind := yamlNodeField(&node, "kind")
		switch kind {
		case "Repository":
			var resource provisioning.Repository
			if err := node.Decode(&resource); err != nil {
				return fmt.Errorf("decode Repository in document %d: %w", document, err)
			}
			if err := applyRepository(ctx, client, &resource); err != nil {
				return fmt.Errorf("Repository %q: %w", resource.Name, err)
			}
		case "Connection":
			var resource provisioning.Connection
			if err := node.Decode(&resource); err != nil {
				return fmt.Errorf("decode Connection in document %d: %w", document, err)
			}
			if err := applyConnection(ctx, client, &resource); err != nil {
				return fmt.Errorf("Connection %q: %w", resource.Name, err)
			}
		default:
			return fmt.Errorf("document %d has unsupported kind %q; expected Repository or Connection", document, kind)
		}
	}
}

func expandEnvironmentNode(node *yaml.Node) {
	if node == nil {
		return
	}
	if node.Kind == yaml.ScalarNode && node.Tag == "!!str" {
		node.Value = os.ExpandEnv(node.Value)
		return
	}
	for _, child := range node.Content {
		expandEnvironmentNode(child)
	}
}

func yamlNodeField(node *yaml.Node, field string) string {
	if node.Kind == yaml.DocumentNode && len(node.Content) > 0 {
		node = node.Content[0]
	}
	if node.Kind != yaml.MappingNode {
		return ""
	}
	for i := 0; i+1 < len(node.Content); i += 2 {
		if node.Content[i].Value == field {
			return node.Content[i+1].Value
		}
	}
	return ""
}

func applyRepository(ctx context.Context, client client.ProvisioningV0alpha1Interface, desired *provisioning.Repository) error {
	namespace := resourceNamespace(desired.Namespace)
	desired.Namespace = namespace

	created, err := client.Repositories(namespace).Create(ctx, desired, metav1.CreateOptions{})
	if err == nil {
		_ = created
		return nil
	}
	if !apierrors.IsAlreadyExists(err) {
		return err
	}

	existing, err := client.Repositories(namespace).Get(ctx, desired.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	desired.ObjectMeta = *existing.ObjectMeta.DeepCopy()
	desired.Namespace = namespace
	_, err = client.Repositories(namespace).Update(ctx, desired, metav1.UpdateOptions{})
	return err
}

func applyConnection(ctx context.Context, client client.ProvisioningV0alpha1Interface, desired *provisioning.Connection) error {
	namespace := resourceNamespace(desired.Namespace)
	desired.Namespace = namespace

	created, err := client.Connections(namespace).Create(ctx, desired, metav1.CreateOptions{})
	if err == nil {
		_ = created
		return nil
	}
	if !apierrors.IsAlreadyExists(err) {
		return err
	}

	existing, err := client.Connections(namespace).Get(ctx, desired.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	desired.ObjectMeta = *existing.ObjectMeta.DeepCopy()
	desired.Namespace = namespace
	_, err = client.Connections(namespace).Update(ctx, desired, metav1.UpdateOptions{})
	return err
}

func resourceNamespace(namespace string) string {
	if namespace == "" {
		return DefaultNamespace
	}
	return namespace
}

func isYAMLFile(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	return ext == ".yaml" || ext == ".yml"
}
