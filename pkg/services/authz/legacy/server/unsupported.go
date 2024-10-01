package server

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func (s *Server) CreateStore(context.Context, *openfgav1.CreateStoreRequest) (*openfgav1.CreateStoreResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) DeleteStore(context.Context, *openfgav1.DeleteStoreRequest) (*openfgav1.DeleteStoreResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) Expand(context.Context, *openfgav1.ExpandRequest) (*openfgav1.ExpandResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) GetStore(context.Context, *openfgav1.GetStoreRequest) (*openfgav1.GetStoreResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) ListStores(context.Context, *openfgav1.ListStoresRequest) (*openfgav1.ListStoresResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) ListUsers(context.Context, *openfgav1.ListUsersRequest) (*openfgav1.ListUsersResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) ReadAssertions(context.Context, *openfgav1.ReadAssertionsRequest) (*openfgav1.ReadAssertionsResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) ReadAuthorizationModel(context.Context, *openfgav1.ReadAuthorizationModelRequest) (*openfgav1.ReadAuthorizationModelResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) ReadAuthorizationModels(context.Context, *openfgav1.ReadAuthorizationModelsRequest) (*openfgav1.ReadAuthorizationModelsResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) ReadChanges(context.Context, *openfgav1.ReadChangesRequest) (*openfgav1.ReadChangesResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) StreamedListObjects(*openfgav1.StreamedListObjectsRequest, openfgav1.OpenFGAService_StreamedListObjectsServer) error {
	return status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) UpdateStore(context.Context, *openfgav1.UpdateStoreRequest) (*openfgav1.UpdateStoreResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) Write(context.Context, *openfgav1.WriteRequest) (*openfgav1.WriteResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) WriteAssertions(context.Context, *openfgav1.WriteAssertionsRequest) (*openfgav1.WriteAssertionsResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}

func (s *Server) WriteAuthorizationModel(context.Context, *openfgav1.WriteAuthorizationModelRequest) (*openfgav1.WriteAuthorizationModelResponse, error) {
	return nil, status.Error(codes.Unimplemented, "not supported for legacy service")
}
