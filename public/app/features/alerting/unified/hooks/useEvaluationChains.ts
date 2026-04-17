import { type EvaluationChain } from '../types/evaluation-chain';

interface UseEvaluationChainsResult {
  chains: EvaluationChain[];
  isLoading: boolean;
}

const MOCK_CHAINS: EvaluationChain[] = [
  {
    uid: 'chain-1',
    name: 'Lan view v1',
    folder: 'alerting',
    interval: '1m',
    recordingRuleRefs: ['http-requests-total', 'error-rate-5m'],
    alertRuleRefs: ['high-error-rate', 'latency-threshold'],
  },
  {
    uid: 'chain-2',
    name: 'Errors in last 1h',
    folder: 'alerting / default',
    interval: '5m',
    recordingRuleRefs: ['error-count-1h'],
    alertRuleRefs: ['critical-error-alert'],
  },
  {
    uid: 'chain-3',
    name: 'Boundary errors counter - last 48h',
    folder: 'alerting / default',
    interval: '10m',
    recordingRuleRefs: ['boundary-errors-48h', 'boundary-rate-calc'],
    alertRuleRefs: ['boundary-threshold-alert', 'boundary-spike-alert'],
  },
  {
    uid: 'chain-4',
    name: 'alerting Frontend Errors',
    folder: 'alerting / frontend-v2',
    interval: '1m',
    recordingRuleRefs: ['frontend-error-rate'],
    alertRuleRefs: ['frontend-error-alert'],
  },
  {
    uid: 'chain-5',
    name: 'Atlassian Test Chain',
    folder: 'Atlassian Test Folder/builder',
    interval: '5m',
    recordingRuleRefs: ['atlassian-request-rate'],
    alertRuleRefs: ['atlassian-latency-alert', 'atlassian-error-alert'],
  },
  {
    uid: 'chain-6',
    name: 'Monthly Cost Threshold',
    folder: 'Billing',
    interval: '1h',
    recordingRuleRefs: ['monthly-cost-sum', 'cost-per-service'],
    alertRuleRefs: ['cost-threshold-exceeded'],
  },
  {
    uid: 'chain-7',
    name: 'PinPoint Latency Chain',
    folder: 'Data and Analytics Engineering / PinPoint Alerts',
    interval: '2m',
    recordingRuleRefs: ['pinpoint-p99-latency', 'pinpoint-request-rate'],
    alertRuleRefs: ['pinpoint-latency-alert'],
  },
  {
    uid: 'chain-8',
    name: 'Datastax Connection Pool',
    folder: 'Datastax Playground',
    interval: '30s',
    recordingRuleRefs: ['connection-pool-usage'],
    alertRuleRefs: ['pool-exhaustion-alert', 'pool-degraded-alert'],
  },
  {
    uid: 'chain-9',
    name: 'General Infrastructure Chain',
    folder: 'General Alerting',
    interval: '5m',
    recordingRuleRefs: ['cpu-usage-rate', 'memory-usage-rate'],
    alertRuleRefs: ['high-cpu-alert', 'high-memory-alert', 'resource-pressure-alert'],
  },
];

/**
 * Mock hook — returns static data until the backend API is ready.
 * Replace with a real RTK Query endpoint when the API is available.
 */
export function useEvaluationChains(): UseEvaluationChainsResult {
  return { chains: MOCK_CHAINS, isLoading: false };
}
