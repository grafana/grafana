import { useReducer, useEffect } from 'react';
import { PluginType, PluginIncludeType } from '@grafana/data';
import { api } from '../api';
import { loadPlugin } from '../../PluginPage';
import { getCatalogPluginDetails, isGrafanaAdmin } from '../helpers';

export enum ActionTypes {
  LOADING,
  INFLIGHT,
  INSTALLED,
  UNINSTALLED,
  UPDATED,
  ERROR,
  FETCHED_PLUGIN,
  FETCHED_PLUGIN_CONFIG,
  UPDATE_TABS,
  SET_ACTIVE_TAB,
}

const defaultTabs = [{ label: 'Overview' }, { label: 'Version history' }];

const initialState = {
  hasInstalledPanel: false,
  hasUpdate: false,
  isAdmin: isGrafanaAdmin(),
  isInstalled: false,
  isInflight: false,
  loading: false,
  plugin: null,
  pluginConfig: null,
  tabs: defaultTabs,
  activeTab: 0,
};

const reducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.LOADING: {
      return { ...state, loading: true };
    }
    case ActionTypes.INFLIGHT: {
      return { ...state, isInflight: true };
    }
    case ActionTypes.ERROR: {
      return { ...state, loading: false, error: action.payload };
    }
    case ActionTypes.FETCHED_PLUGIN: {
      return {
        ...state,
        loading: false,
        plugin: action.payload,
        isInstalled: action.payload.isInstalled,
        hasUpdate: action.payload.hasUpdate,
      };
    }
    case ActionTypes.FETCHED_PLUGIN_CONFIG: {
      return {
        ...state,
        loading: false,
        pluginConfig: action.payload,
      };
    }
    case ActionTypes.UPDATE_TABS: {
      return {
        ...state,
        tabs: action.payload,
      };
    }
    case ActionTypes.INSTALLED: {
      return {
        ...state,
        isInflight: false,
        isInstalled: true,
        hasInstalledPanel: action.payload,
      };
    }
    case ActionTypes.UNINSTALLED: {
      return {
        ...state,
        isInflight: false,
        isInstalled: false,
      };
    }
    case ActionTypes.UPDATED: {
      return {
        ...state,
        hasUpdate: false,
        isInflight: false,
      };
    }
    case ActionTypes.SET_ACTIVE_TAB: {
      return {
        ...state,
        activeTab: action.payload,
      };
    }
  }
};

export const usePluginDetails = (id: string) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const fetchPlugin = async () => {
      dispatch({ type: ActionTypes.LOADING });
      try {
        const value = await api.getPlugin(id);
        const plugin = getCatalogPluginDetails(value?.local, value?.remote, value?.remoteVersions);
        dispatch({ type: ActionTypes.FETCHED_PLUGIN, payload: plugin });
      } catch (error) {
        dispatch({ type: ActionTypes.ERROR, payload: error });
      }
    };
    fetchPlugin();
  }, [id]);

  useEffect(() => {
    const fetchPluginConfig = async () => {
      if (state.isInstalled) {
        dispatch({ type: ActionTypes.LOADING });
        try {
          const pluginConfig = await loadPlugin(id);
          dispatch({ type: ActionTypes.FETCHED_PLUGIN_CONFIG, payload: pluginConfig });
        } catch (error) {
          dispatch({ type: ActionTypes.ERROR, payload: error });
        }
      } else {
        // reset tabs
        dispatch({ type: ActionTypes.FETCHED_PLUGIN_CONFIG, payload: null });
        dispatch({ type: ActionTypes.SET_ACTIVE_TAB, payload: 0 });
      }
    };
    fetchPluginConfig();
  }, [state.isInstalled, id]);

  useEffect(() => {
    const pluginConfig = state.pluginConfig;
    const tabs: Array<{ label: string }> = [...defaultTabs];

    if (pluginConfig && state.isAdmin) {
      if (pluginConfig.meta.type === PluginType.app) {
        if (pluginConfig.angularConfigCtrl) {
          tabs.push({
            label: 'Config',
          });
        }

        if (pluginConfig.configPages) {
          for (const page of pluginConfig.configPages) {
            tabs.push({
              label: page.title,
            });
          }
        }

        if (pluginConfig.meta.includes?.find((include) => include.type === PluginIncludeType.dashboard)) {
          tabs.push({
            label: 'Dashboards',
          });
        }
      }
    }
    dispatch({ type: ActionTypes.UPDATE_TABS, payload: tabs });
  }, [state.isAdmin, state.pluginConfig, id]);

  return [state, dispatch];
};
