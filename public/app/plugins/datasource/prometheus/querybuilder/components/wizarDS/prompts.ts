// UPDATE THIS FOR THE PROMPT
// make one for wizard
// need a system AND a user prompt?

import { Suggestion } from './types';

// You are an expert in Prometheus, the event monitoring and alerting application.
// You are an expert in the Prometheus data source in Grafana.

// Use this link as a resource to learn more.
// https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/

// Please summarize this page by elements and create a list of elements.

// Here is a link to documentation for you to read about the _ data source:
// https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#prometheus-query-editor

// rewrite with a type
export type SuggestSystemPromptParams = {
  question?: string;
  templates?: Suggestion[];
  // unneccessay for now
  // promql?: string;
  // labels?: string;
  // templates?: string;
};

// You are a Grafana expert.
export function GetComponentSuggestionsSystemPrompt({ templates }: SuggestSystemPromptParams): string {
  return `
  Here is a list of elements in the query editor in JSON format:
  ${templates}

  Please study the JSON list. You will only return exact objects from this list for your responses ${templates}
`;
}

export function GetComponentSuggestionsUserPrompt({ templates, question }: SuggestSystemPromptParams): string {
  return `
  Here is a user question: "${question}".
  
  Here is the same JSON list of objects you saw before:
  ${templates}

  Only return exact copies of these objects${templates}.
  
  Return exact copies of these JSON objects ${templates} that best match the user question by the attributes 'component' and 'explanation'.

  Each object should have the same values for the keys 'component', 'explanation', 'testid', 'order' and 'link'. Do not hallucinate new attributes or replace values. Do not replace any values in the JSON.

  Do not return any prose.  
`;
}

// export const ExplainSystemPrompt = `You are an expert in Prometheus, the event monitoring and alerting application.

// You are given relevant PromQL documentation, a type and description for a Prometheus metric, and a PromQL query on that metric. Using the provided information for reference, please explain what the output of a given query is in 1 sentences. Do not walk through what the functions do separately, make your answer concise.

// Input will be in the form:

// PromQL Documentation:
// <PromQL documentation>

// PromQL Metrics Metadata:
// <metric_name>(<metric type of the metric queried>): <description of what the metric means>

// PromQL Expression:
// <PromQL query>

// Examples of input and output
// ----------
// PromQL Documentation:
// A counter is a cumulative metric that represents a single monotonically increasing counter whose value can only increase or be reset to zero on restart. For example, you can use a counter to represent the number of requests served, tasks completed, or errors.
// topk (largest k elements by sample value)
// sum (calculate sum over dimensions)
// rate(v range-vector) calculates the per-second average rate of increase of the time series in the range vector. Breaks in monotonicity (such as counter resets due to target restarts) are automatically adjusted for.

// PromQL Metrics Metadata:
// traces_exporter_sent_spans(counter): Number of spans successfully sent to destination.

// PromQL Expression:
// topk(3, sum by(cluster) (rate(traces_exporter_sent_spans{exporter="otlp"}[5m])))

// This query is trying to answer the question:
// What is the top 3 clusters that have successfully sent the most number of spans to the destination?
// `;

// export type ExplainUserPromptParams = {
//   documentation: string;
//   metricName: string;
//   metricType: string;
//   metricMetadata: string;
//   query: string;
// };

// export function GetExplainUserPrompt({
//   documentation,
//   metricName,
//   metricType,
//   metricMetadata,
//   query,
// }: ExplainUserPromptParams): string {
//   if (documentation === '') {
//     documentation = 'No documentation provided.';
//   }
//   if (metricMetadata === '') {
//     metricMetadata = 'No description provided.';
//   }
//   return `
//         PromQL Documentation:
//         ${documentation}

//         PromQL Metrics Metadata:
//         ${metricName}(${metricType}): ${metricMetadata}

//         PromQL Expression:
//         ${query}

//         This query is trying to answer the question:
//     `;
// }

// export function GetSuggestSystemPrompt({ promql, question, labels, templates }: SuggestSystemPromptParams): string {
//   if (templates === '') {
//     templates = 'No templates provided.';
//   }
//   return `You are an PromQL expert assistant. You will be is given a PromQL expression and a user question.
// You are to edit the PromQL expression so that it answers the user question. Show only the edited PromQL.

// The initial PromQL query is
// \`\`\`
// ${promql}
// \`\`\`
// The user question is: "${question}"

// To help you answer the question, here are 2 pieces of information:

// 1. List of labels to use: ${labels}
// 2. Here is a list of possibly relevant PromQL template expressions with descriptions to help target your answer:
// ${templates}

// Rules:
// - Do not invent labels names, you must use only the labels provided.

// Answer:
// \`\`\``;
// }
