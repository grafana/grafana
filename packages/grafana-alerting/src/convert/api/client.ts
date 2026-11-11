import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '@grafana/api-clients/rtkq';

import {
  type ConvertAlertmanagerOptions,
  type ConvertRulesFolderOptions,
  type ConvertRulesOptions,
  getConvertAlertmanagerHeaders,
  getConvertRulesFolderHeaders,
  getConvertRulesHeaders,
} from './headers';
import {
  type AlertmanagerUserConfig,
  type ConvertAlertmanagerResponse,
  type ConvertPrometheusResponse,
  type RulerRuleGroupDTO,
  type RulerRulesConfigDTO,
} from './types';

// The mimirtool paths. Grafana also serves the same handlers under `/api/convert/api/prom/rules` for cortextool.
const RULES_PATH = '/prometheus/config/v1/rules';
const ALERTMANAGER_PATH = '/api/v1/alerts';

// Rule reads answer in YAML unless JSON is asked for, to keep mimirtool working.
const ACCEPT_JSON = { Accept: 'application/json' };

const RULES_TAG = 'ConvertedRules';
const ALERTMANAGER_TAG = 'ImportedAlertmanagerConfig';

type NamespaceArg = ConvertRulesFolderOptions & { namespace: string };
type RuleGroupArg = NamespaceArg & { group: string };

const namespacePath = (namespace: string) => `${RULES_PATH}/${encodeURIComponent(namespace)}`;
const ruleGroupPath = (namespace: string, group: string) => `${namespacePath(namespace)}/${encodeURIComponent(group)}`;

/**
 * RTKQ client for Grafana's Prometheus convert API. Rules and Alertmanager configs written through it
 * become Grafana-managed; reads only return what was imported through this API.
 */
export const convertAPI = createApi({
  reducerPath: 'alertingConvertAPI',
  baseQuery: createBaseQuery({ baseURL: '/api/convert' }),
  tagTypes: [RULES_TAG, ALERTMANAGER_TAG],
  endpoints: (build) => ({
    /** All imported rule groups, keyed by namespace. */
    getRules: build.query<RulerRulesConfigDTO, ConvertRulesFolderOptions | void>({
      query: (options) => ({
        url: RULES_PATH,
        headers: { ...ACCEPT_JSON, ...getConvertRulesFolderHeaders(options ?? {}) },
      }),
      providesTags: [RULES_TAG],
    }),

    /** The imported rule groups of one namespace, keyed by that namespace. */
    getNamespace: build.query<RulerRulesConfigDTO, NamespaceArg>({
      query: ({ namespace, ...options }) => ({
        url: namespacePath(namespace),
        headers: { ...ACCEPT_JSON, ...getConvertRulesFolderHeaders(options) },
      }),
      providesTags: [RULES_TAG],
    }),

    getRuleGroup: build.query<RulerRuleGroupDTO, RuleGroupArg>({
      query: ({ namespace, group, ...options }) => ({
        url: ruleGroupPath(namespace, group),
        headers: { ...ACCEPT_JSON, ...getConvertRulesFolderHeaders(options) },
      }),
      providesTags: [RULES_TAG],
    }),

    /** Imports rule groups for several namespaces at once, creating or replacing each group. */
    postRuleGroups: build.mutation<ConvertPrometheusResponse, ConvertRulesOptions & { payload: RulerRulesConfigDTO }>({
      query: ({ payload, ...options }) => ({
        url: RULES_PATH,
        method: 'POST',
        body: payload,
        headers: getConvertRulesHeaders(options),
      }),
      invalidatesTags: [RULES_TAG],
    }),

    /**
     * Imports one rule group into a namespace. Fails when a group with the same name exists there and
     * wasn't imported through this API.
     */
    postRuleGroup: build.mutation<
      ConvertPrometheusResponse,
      ConvertRulesOptions & { namespace: string; payload: RulerRuleGroupDTO }
    >({
      query: ({ namespace, payload, ...options }) => ({
        url: namespacePath(namespace),
        method: 'POST',
        body: payload,
        headers: getConvertRulesHeaders(options),
      }),
      invalidatesTags: [RULES_TAG],
    }),

    /** Deletes the imported rule groups in a namespace. Groups created any other way are left alone. */
    deleteNamespace: build.mutation<ConvertPrometheusResponse, NamespaceArg>({
      query: ({ namespace, ...options }) => ({
        url: namespacePath(namespace),
        method: 'DELETE',
        headers: getConvertRulesFolderHeaders(options),
      }),
      invalidatesTags: [RULES_TAG],
    }),

    /** Deletes one rule group, if it was imported through this API. */
    deleteRuleGroup: build.mutation<ConvertPrometheusResponse, RuleGroupArg>({
      query: ({ namespace, group, ...options }) => ({
        url: ruleGroupPath(namespace, group),
        method: 'DELETE',
        headers: getConvertRulesFolderHeaders(options),
      }),
      invalidatesTags: [RULES_TAG],
    }),

    /** An imported Alertmanager config, with its secrets removed. */
    getAlertmanagerConfig: build.query<AlertmanagerUserConfig, Pick<ConvertAlertmanagerOptions, 'identifier'>>({
      query: (options) => ({
        url: ALERTMANAGER_PATH,
        headers: { ...ACCEPT_JSON, ...getConvertAlertmanagerHeaders(options) },
      }),
      providesTags: [ALERTMANAGER_TAG],
    }),

    /**
     * Imports an Alertmanager config next to Grafana's own, or merges it in with `promote`. With `dryRun` it
     * only reports what would happen, so nothing is refetched.
     */
    postAlertmanagerConfig: build.mutation<
      ConvertAlertmanagerResponse,
      ConvertAlertmanagerOptions & { payload: AlertmanagerUserConfig }
    >({
      query: ({ payload, ...options }) => ({
        url: ALERTMANAGER_PATH,
        method: 'POST',
        body: payload,
        headers: getConvertAlertmanagerHeaders(options),
      }),
      invalidatesTags: (_result, _error, { dryRun }) => (dryRun ? [] : [ALERTMANAGER_TAG]),
    }),

    /** Deletes an imported Alertmanager config. Grafana's own config is not affected. */
    deleteAlertmanagerConfig: build.mutation<ConvertPrometheusResponse, Pick<ConvertAlertmanagerOptions, 'identifier'>>(
      {
        query: (options) => ({
          url: ALERTMANAGER_PATH,
          method: 'DELETE',
          headers: getConvertAlertmanagerHeaders(options),
        }),
        invalidatesTags: [ALERTMANAGER_TAG],
      }
    ),

    /**
     * Merges an imported Alertmanager config into Grafana's own config for good. Its contact points,
     * routes, time intervals and templates become editable, and the separate imported config is removed.
     */
    promoteAlertmanagerConfig: build.mutation<
      ConvertAlertmanagerResponse,
      Pick<ConvertAlertmanagerOptions, 'identifier'>
    >({
      query: ({ identifier }) => ({
        url: `${ALERTMANAGER_PATH}/${encodeURIComponent(identifier)}/promote`,
        method: 'POST',
      }),
      invalidatesTags: [ALERTMANAGER_TAG],
    }),
  }),
});
