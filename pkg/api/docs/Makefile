.DEFAULT_GOAL := openapi

API_DIR = definitions
GO_PKG_FILES = $(shell find $(API_DIR) -name *.go -print)
SWAGGER_TAG ?= latest
SWAGGER_CODEGEN_TAG ?= latest

spec.json: $(GO_PKG_FILES)
	# this is slow because this image does not use the cache
	# https://github.com/go-swagger/go-swagger/blob/v0.27.0/Dockerfile#L5
	docker run --rm -it \
	-e GOPATH=${HOME}/go:/go \
	-e SWAGGER_GENERATE_EXTENSION=false \
	-v ${HOME}/go:${HOME}/go \
	-v $$(pwd)/../../..:${HOME}/grafana \
	-v $$(pwd)/definitions:/src \
	-w $$(pwd) quay.io/goswagger/swagger:$(SWAGGER_TAG) \
	generate spec -m -o spec.json -i ${HOME}/grafana/pkg/api/docs/tags.json

ensure_go-swagger_mac:
	@hash swagger &>/dev/null || (brew tap go-swagger/go-swagger && brew install go-swagger)

spec-mac: ensure_go-swagger_mac $(GO_PKG_FILES)
	swagger generate spec -m -w $(API_DIR) -o spec.json -i tags.json

.PHONY: openapi
openapi: spec.json
	docker-compose up

clean-spec:
	rm spec.json

clean-containers:
	docker-compose down

client-go:
	docker run --rm \
	-e GOPATH=${HOME}/go:/go \
	--user $$(id -u):$$(id -g) \
	-v ${HOME}/go:${HOME}/go \
	-v $$(pwd)/../../..:${HOME}/grafana \
	swaggerapi/swagger-codegen-cli:$(SWAGGER_CODEGEN_TAG) generate \
	-i ${HOME}/grafana/pkg/api/docs/spec.json \
	-l go \
	--additional-properties packageName=go_client \
	-DdebugOperations \
	-o ${HOME}/grafana/pkg/api/clients/go \
	-t ${HOME}/grafana/pkg/api/docs/templates/go \
	--type-mappings SaveDashboardCommand=models.SaveDashboardCommand \
	--import-mappings SaveDashboardCommand=models.SaveDashboardCommand \
	--type-mappings AddApiKeyCommand=models.AddApiKeyCommand \
	--import-mappings AddApiKeyCommand=models.AddApiKeyCommand \
	--type-mappings ApiKeyDTO=models.ApiKeyDTO \
	--import-mappings ApiKeyDTO=models.ApiKeyDTO \
	--type-mappings TrimDashboardCommand=models.TrimDashboardCommand \
	--import-mappings TrimDashboardCommand=models.TrimDashboardCommand \
	--type-mappings DashboardTagCloudItem=models.DashboardTagCloudItem \
	--import-mappings DashboardTagCloudItem=models.DashboardTagCloudItem \
	--type-mappings DashboardAclInfoDTO=models.DashboardAclInfoDTO \
	--import-mappings DashboardAclInfoDTO=models.DashboardAclInfoDTO \
	--type-mappings DashboardVersionMeta=models.DashboardVersionMeta \
	--import-mappings DashboardVersionMeta=models.DashboardVersionMeta \
	--type-mappings AddDataSourceCommand=models.AddDataSourceCommand \
	--import-mappings AddDataSourceCommand=models.AddDataSourceCommand \
	--type-mappings UpdateDataSourceCommand=models.UpdateDataSourceCommand \
	--import-mappings UpdateDataSourceCommand=models.UpdateDataSourceCommand \
	--type-mappings CreateFolderCommand=models.CreateFolderCommand \
	--import-mappings CreateFolderCommand=models.CreateFolderCommand \
	--type-mappings UpdateFolderCommand=models.UpdateFolderCommand \
	--import-mappings UpdateFolderCommand=models.UpdateFolderCommand \
	--type-mappings DashboardSnapshotDTO=models.DashboardSnapshotDTO \
	--import-mappings DashboardSnapshotDTO=models.DashboardSnapshotDTO \
	--type-mappings UpdateUserCommand=models.UpdateUserCommand \
	--import-mappings UpdateUserCommand=models.UpdateUserCommand \
	--type-mappings SearchUserQueryResult=models.SearchUserQueryResult \
	--import-mappings SearchUserQueryResult=models.SearchUserQueryResult \
	--type-mappings UserOrgDTO=models.UserOrgDTO \
	--import-mappings UserOrgDTO=models.UserOrgDTO \
	--type-mappings TeamDTO=models.TeamDTO \
	--import-mappings TeamDTO=models.TeamDTO \
	--type-mappings NewApiKeyResult=dtos.NewApiKeyResult \
	--import-mappings NewApiKeyResult=dtos.NewApiKeyResult \
	--type-mappings CalculateDiffTarget=dtos.CalculateDiffTarget \
	--import-mappings CalculateDiffTarget=dtos.CalculateDiffTarget \
	--type-mappings ImportDashboardCommand=dtos.ImportDashboardCommand \
	--import-mappings ImportDashboardCommand=dtos.ImportDashboardCommand \
	--type-mappings DashboardFullWithMeta=dtos.DashboardFullWithMeta \
	--import-mappings DashboardFullWithMeta=dtos.DashboardFullWithMeta \
	--type-mappings TrimDashboardFullWithMeta=dtos.TrimDashboardFullWithMeta \
	--import-mappings TrimDashboardFullWithMeta=dtos.TrimDashboardFullWithMeta \
	--type-mappings DashboardFullWithMeta=dtos.DashboardFullWithMeta \
	--import-mappings DashboardFullWithMeta=dtos.DashboardFullWithMeta \
	--type-mappings DashboardRedirect=dtos.DashboardRedirect \
	--import-mappings DashboardRedirect=dtos.DashboardRedirect \
	--type-mappings DataSourceList=dtos.DataSourceList \
	--import-mappings DataSourceList=dtos.DataSourceList \
	--type-mappings DataSource=dtos.DataSource \
	--import-mappings DataSource=dtos.DataSource \
	--type-mappings FolderSearchHit=dtos.FolderSearchHit \
	--import-mappings FolderSearchHit=dtos.FolderSearchHit \
	--type-mappings Folder=dtos.Folder \
	--import-mappings Folder=dtos.Folder \
	--type-mappings Prefs=dtos.Prefs \
	--import-mappings Prefs=dtos.Prefs \
	--type-mappings CreateDashboardSnapshotCommand=models.CreateDashboardSnapshotCommand \
	--import-mappings CreateDashboardSnapshotCommand=models.CreateDashboardSnapshotCommand \
	--type-mappings DashboardAclUpdateItem=dtos.DashboardAclUpdateItem \
	--import-mappings DashboardAclUpdateItem=dtos.DashboardAclUpdateItem \
	--type-mappings DashboardAclUpdateItem=dtos.DashboardAclUpdateItem \
	--import-mappings DashboardAclUpdateItem=dtos.DashboardAclUpdateItem
	goimports -w -v ../clients/go

client-python:
	docker run --rm \
	--user $$(id -u):$$(id -g) \
	-v $$(pwd)/../../..:${HOME}/grafana \
	swaggerapi/swagger-codegen-cli generate \
	-i ${HOME}/grafana/pkg/api/docs/spec.json \
	-l python \
	-o ${HOME}/grafana/pkg/api/clients/python

clean-clients:
	rm -rf ../clients
