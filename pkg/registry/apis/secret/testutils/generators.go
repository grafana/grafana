package testutils

import (
	"fmt"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
	"pgregory.net/rapid"
)

var (
	DecryptersGen      = rapid.SampledFrom([]string{"svc1", "svc2", "svc3", "svc4", "svc5"})
	SecureValueNameGen = rapid.SampledFrom([]string{"n1", "n2", "n3", "n4", "n5"})
	KeeperNameGen      = rapid.SampledFrom([]string{"k1", "k2", "k3", "k4", "k5"})
	NamespaceGen       = rapid.SampledFrom([]string{"ns1", "ns2", "ns3", "ns4", "ns5"})
	SecretsToRefGen    = rapid.SampledFrom([]string{"ref1", "ref2", "ref3", "ref4", "ref5"})
	// Generator for secure values that specify a secret value
	AnySecureValueGen = rapid.Custom(func(t *rapid.T) *secretv1beta1.SecureValue {
		return &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      SecureValueNameGen.Draw(t, "name"),
				Namespace: NamespaceGen.Draw(t, "ns"),
			},
			Spec: secretv1beta1.SecureValueSpec{
				Description: rapid.SampledFrom([]string{"d1", "d2", "d3", "d4", "d5"}).Draw(t, "description"),
				Value:       ptr.To(secretv1beta1.NewExposedSecureValue(rapid.SampledFrom([]string{"v1", "v2", "v3", "v4", "v5"}).Draw(t, "value"))),
				Decrypters:  rapid.SliceOfDistinct(DecryptersGen, func(v string) string { return v }).Draw(t, "decrypters"),
			},
			Status: secretv1beta1.SecureValueStatus{},
		}
	})
	// Generator for secure values that reference values from 3rd party stores
	AnySecureValueWithRefGen = rapid.Custom(func(t *rapid.T) *secretv1beta1.SecureValue {
		return &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      SecureValueNameGen.Draw(t, "name"),
				Namespace: NamespaceGen.Draw(t, "ns"),
			},
			Spec: secretv1beta1.SecureValueSpec{
				Description: rapid.SampledFrom([]string{"d1", "d2", "d3", "d4", "d5"}).Draw(t, "description"),
				Ref:         ptr.To(SecretsToRefGen.Draw(t, "ref")),
				Decrypters:  rapid.SliceOfDistinct(DecryptersGen, func(v string) string { return v }).Draw(t, "decrypters"),
			},
			Status: secretv1beta1.SecureValueStatus{},
		}
	})
	UpdateSecureValueGen = rapid.Custom(func(t *rapid.T) *secretv1beta1.SecureValue {
		sv := AnySecureValueGen.Draw(t, "sv")
		// Maybe update the secret value, maybe not
		if !rapid.Bool().Draw(t, "should_update_value") {
			sv.Spec.Value = nil
		}
		return sv
	})
	DecryptGen = rapid.Custom(func(t *rapid.T) DecryptInput {
		return DecryptInput{
			Namespace: NamespaceGen.Draw(t, "ns"),
			Name:      SecureValueNameGen.Draw(t, "name"),
			Decrypter: DecryptersGen.Draw(t, "decrypter"),
		}
	})
	AnyKeeperGen = rapid.Custom(func(t *rapid.T) *secretv1beta1.Keeper {
		spec := secretv1beta1.KeeperSpec{
			Description: rapid.String().Draw(t, "description"),
		}

		keeperType := rapid.SampledFrom([]string{"isAwsKeeper", "isAzureKeeper", "isGcpKeeper", "isVaultKeeper"}).Draw(t, "keeperType")
		switch keeperType {
		case "isAwsKeeper":
			spec.Aws = &secretv1beta1.KeeperAWSConfig{}
		case "isAzureKeeper":
			spec.Azure = &secretv1beta1.KeeperAzureConfig{}
		case "isGcpKeeper":
			spec.Gcp = &secretv1beta1.KeeperGCPConfig{}
		case "isVaultKeeper":
			spec.HashiCorpVault = &secretv1beta1.KeeperHashiCorpConfig{}
		default:
			panic(fmt.Sprintf("unhandled keeper type '%+v', did you forget a switch case?", keeperType))
		}

		return &secretv1beta1.Keeper{
			ObjectMeta: metav1.ObjectMeta{
				Name:      KeeperNameGen.Draw(t, "name"),
				Namespace: NamespaceGen.Draw(t, "ns"),
			},
			Spec: spec,
		}
	})
)

type DecryptInput struct {
	Namespace string
	Name      string
	Decrypter string
}
