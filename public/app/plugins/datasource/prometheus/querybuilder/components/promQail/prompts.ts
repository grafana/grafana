export const ExplainSystemPrompt = `You are an expert in Prometheus, the event monitoring and alerting application.

You are given relevant PromQL documentation, a type and description for a Prometheus metric, and a PromQL query on that metric. Using the provided information for reference, please explain what the output of a given query is in 1 sentences. Do not walk through what the functions do separately, make your answer concise. 

Input will be in the form:


PromQL Documentation:
<PromQL documentation>

PromQL Metrics Metadata:
<metric_name>(<metric type of the metric queried>): <description of what the metric means>

PromQL Expression: 
<PromQL query>

Examples of input and output
----------
PromQL Documentation:
A counter is a cumulative metric that represents a single monotonically increasing counter whose value can only increase or be reset to zero on restart. For example, you can use a counter to represent the number of requests served, tasks completed, or errors.
topk (largest k elements by sample value)
sum (calculate sum over dimensions)
rate(v range-vector) calculates the per-second average rate of increase of the time series in the range vector. Breaks in monotonicity (such as counter resets due to target restarts) are automatically adjusted for. 

PromQL Metrics Metadata:
traces_exporter_sent_spans(counter): Number of spans successfully sent to destination.

PromQL Expression:
topk(3, sum by(cluster) (rate(traces_exporter_sent_spans{exporter="otlp"}[5m])))

This query is trying to answer the question:
What is the top 3 clusters that have successfully sent the most number of spans to the destination?
`;

export type ExplainUserPromptParams = {
  documentation: string;
  metricName: string;
  metricType: string;
  metricMetadata: string;
  query: string;
};

export function GetExplainUserPrompt({
  documentation,
  metricName,
  metricType,
  metricMetadata,
  query,
}: ExplainUserPromptParams): string {
  if (documentation === '') {
    documentation = 'No documentation provided.';
  }
  if (metricMetadata === '') {
    metricMetadata = 'No description provided.';
  }
  return `
        PromQL Documentation: 
        ${documentation}

        PromQL Metrics Metadata:
        ${metricName}(${metricType}): ${metricMetadata}

        PromQL Expression: 
        ${query}

        This query is trying to answer the question:
    `;
}

export const SuggestSystemPrompt = `You are a Prometheus Query Language (PromQL) expert assistant inside Grafana.
When the user asks a question, respond with a valid PromQL query and only the query.

To help you answer the question, you will receive:
- List of potentially relevant PromQL templates with descriptions, ranked by semantic search score
- Prometheus metric
- Metric type
- Available Prometheus metric labels
- User question

Policy:
- Do not invent labels names, you can only use the available labels
- For rate queries, use the $__rate_interval variable`;

// rewrite with a type
export type SuggestUserPromptParams = {
  promql: string;
  question: string;
  metricType: string;
  labels: string;
  templates: string;
};

export function GetSuggestUserPrompt({
  promql,
  question,
  metricType,
  labels,
  templates,
}: SuggestUserPromptParams): string {
  if (templates === '') {
    templates = 'No templates provided.';
  } else {
    templates = templates.replace(/\n/g, '\n  ');
  }
  return `Relevant PromQL templates:
  ${templates}
  
  Prometheus metric: ${promql}
  Metric type: ${metricType}
  Available Prometheus metric labels: ${labels}
  User question: ${question}
  
  \`\`\`promql`;
}
