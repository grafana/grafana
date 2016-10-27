package tsdb

import "context"

type Executor interface {
	Execute(ctx context.Context, queries QuerySlice, query *QueryContext) *BatchResult
}

var registry map[string]GetExecutorFn

type GetExecutorFn func(dsInfo *DataSourceInfo) Executor

func init() {
	registry = make(map[string]GetExecutorFn)
}

func getExecutorFor(dsInfo *DataSourceInfo) Executor {
	if fn, exists := registry[dsInfo.PluginId]; exists {
		return fn(dsInfo)
	}
	return nil
}

func RegisterExecutor(pluginId string, fn GetExecutorFn) {
	registry[pluginId] = fn
}
