KUBE_IPS       := 10.32.0.1,10.240.0.10,10.240.0.11,10.240.0.12,127.0.0.1
KUBE_HOSTNAMES := localhost,kubernetes,kubernetes.default,kubernetes.default.svc,kubernetes.default.svc.cluster,kubernetes.svc.cluster.local

CFG_DIR        := pki
CERT_DIR       := certs
CERT_CA        := $(CERT_DIR)/ca.pem $(CERT_DIR)/ca-key.pem
CERT_SA        := $(CERT_DIR)/service-account.pem $(CERT_DIR)/service-account-key.pem
CERT_KUBE      := $(CERT_DIR)/kubernetes.pem $(CERT_DIR)/kubernetes-key.pem
CERT_INTENTAPI := $(CERT_DIR)/intentapi.pem $(CERT_DIR)/intentapi-key.pem
CERT_ADMIN     := $(CERT_DIR)/admin.pem $(CERT_DIR)/admin-key.pem

all: clean install-tools certs config

certs: $(CERT_CA) $(CERT_SA) $(CERT_KUBE) $(CERT_INTENTAPI) $(CERT_ADMIN)

$(CERT_CA):
	@$(CFSSL) gencert \
		-initca $(CFG_DIR)/ca-csr.json | $(CFSSLJSON) -bare $(CERT_DIR)/ca

$(CERT_SA):
	@$(CFSSL) gencert -profile=kubernetes \
		-ca=$(CERT_DIR)/ca.pem \
		-ca-key=$(CERT_DIR)/ca-key.pem \
		-config=$(CFG_DIR)/ca-config.json \
		$(CFG_DIR)/service-account-csr.json | $(CFSSLJSON) -bare $(CERT_DIR)/service-account

$(CERT_KUBE):
	@$(CFSSL) gencert -profile=kubernetes \
		-ca=$(CERT_DIR)/ca.pem \
		-ca-key=$(CERT_DIR)/ca-key.pem \
		-config=$(CFG_DIR)/ca-config.json \
		-hostname=$(KUBE_IPS),$(KUBE_HOSTNAMES) \
		$(CFG_DIR)/kubernetes-csr.json | $(CFSSLJSON) -bare $(CERT_DIR)/kubernetes

$(CERT_INTENTAPI):
	@$(CFSSL) gencert -profile=kubernetes \
		-ca=$(CERT_DIR)/ca.pem \
		-ca-key=$(CERT_DIR)/ca-key.pem \
		-config=$(CFG_DIR)/ca-config.json \
		-hostname=$(KUBE_IPS),$(KUBE_HOSTNAMES) \
		$(CFG_DIR)/intentapi-csr.json | $(CFSSLJSON) -bare $(CERT_DIR)/intentapi

$(CERT_ADMIN):
	@$(CFSSL) gencert -profile=kubernetes \
		-ca=$(CERT_DIR)/ca.pem \
		-ca-key=$(CERT_DIR)/ca-key.pem \
		-config=$(CFG_DIR)/ca-config.json \
		$(CFG_DIR)/admin-csr.json | $(CFSSLJSON) -bare $(CERT_DIR)/admin

KUBE_USER            := admin
KUBE_CLUSTER         := intentapi
KUBECONFIG_DIRECT    := apiserver.kubeconfig
KUBE_HOST_DIRECT     := localhost
KUBE_PORT_DIRECT     := 6443
KUBECONFIG_INTENTAPI := intentapi.kubeconfig
KUBE_HOST_INTENTAPI  := localhost
KUBE_PORT_INTENTAPI  := 8443

config: $(KUBECONFIG_DIRECT) $(KUBECONFIG_INTENTAPI)
$(KUBECONFIG_DIRECT):
	@kubectl config set-cluster $(KUBE_CLUSTER) \
		--embed-certs=true \
		--certificate-authority=$(CERT_DIR)/ca.pem \
		--server=https://$(KUBE_HOST_DIRECT):$(KUBE_PORT_DIRECT) \
		--kubeconfig=$(KUBECONFIG_DIRECT)

	@kubectl config set-credentials admin \
		--embed-certs=true \
		--client-certificate=$(CERT_DIR)/admin.pem \
		--client-key=$(CERT_DIR)/admin-key.pem \
		--kubeconfig=$(KUBECONFIG_DIRECT)

	@kubectl config set-context default \
		--cluster=$(KUBE_CLUSTER) \
		--user=$(KUBE_USER) \
		--kubeconfig=$(KUBECONFIG_DIRECT)

	@kubectl config use-context default --kubeconfig=$(KUBECONFIG_DIRECT)

$(KUBECONFIG_INTENTAPI):
	@kubectl config set-cluster $(KUBE_CLUSTER) \
		--embed-certs=true \
		--certificate-authority=$(CERT_DIR)/ca.pem \
		--server=https://$(KUBE_HOST_INTENTAPI):$(KUBE_PORT_INTENTAPI) \
		--kubeconfig=$(KUBECONFIG_INTENTAPI)

	@kubectl config set-credentials admin \
		--embed-certs=true \
		--client-certificate=$(CERT_DIR)/admin.pem \
		--client-key=$(CERT_DIR)/admin-key.pem \
		--kubeconfig=$(KUBECONFIG_INTENTAPI)

	@kubectl config set-context default \
		--cluster=$(KUBE_CLUSTER) \
		--user=$(KUBE_USER) \
		--kubeconfig=$(KUBECONFIG_INTENTAPI)

	@kubectl config use-context default --kubeconfig=$(KUBECONFIG_INTENTAPI)

CFSSL         := ${GOPATH}/bin/cfssl
CFSSLJSON     := ${GOPATH}/bin/cfssljson
CFSSL_VERSION := 1.6.1

install-tools: $(CFSSL) $(CFSSLJSON)

$(CFSSL):
	@go install github.com/cloudflare/cfssl/cmd/cfssl@v$(CFSSL_VERSION)

$(CFSSLJSON):
	@go install github.com/cloudflare/cfssl/cmd/cfssljson@v$(CFSSL_VERSION)

.PHONY: clean
clean:
	@rm -f $(CERT_DIR)/*.pem $(CERT_DIR)/*.csr
	@rm -f $(KUBECONFIG_DIRECT)
	@rm -f $(KUBECONFIG_INTENTAPI)
