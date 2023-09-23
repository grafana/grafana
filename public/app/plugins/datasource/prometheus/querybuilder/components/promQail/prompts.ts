

export const ExplainSystemPrompt = `You are an expert in Prometheus, the event monitoring and alerting application.

You are given relevant PromQL documentation, a type and description for a Prometheus metric, and a PromQL query on that metric. Using the provided information for reference, please explain what the output of a given query is in 1 sentences. Do not walk through what the functions do separately, make your answer concise. 

Input will be in the form:

<PromQL documentation>

Metric Type: 
<metric type of the metric queried>

Description: 
<description of what the metric means>

PromQL Expression: 
<PromQL query>

Examples of input and output
----------
PromQL Documentation:
A counter is a cumulative metric that represents a single monotonically increasing counter whose value can only increase or be reset to zero on restart. For example, you can use a counter to represent the number of requests served, tasks completed, or errors.
topk (largest k elements by sample value)
sum (calculate sum over dimensions)
rate(v range-vector) calculates the per-second average rate of increase of the time series in the range vector. Breaks in monotonicity (such as counter resets due to target restarts) are automatically adjusted for. 

Metric Type: 
Counter

Description: 
Number of spans successfully sent to destination.

PromQL Expression:
topk(3, sum by(cluster) (rate(traces_exporter_sent_spans{exporter="otlp"}[5m])))

Output:
This query helps identify the top 3 clusters that have successfully sent the most number of spans to the destination.
`

export function GetExplainUserPrompt(documentation: string, metricType: string, description: string, query: string) {
    if (documentation === "") {
        documentation = "No documentation provided."
    }
    if (description === "") {
        description = "No description provided."
    }
    return `
        PromQL Documentation: 
        ${documentation}

        Metric Type: 
        ${metricType}

        Description: 
        ${description}

        PromQL Expression: 
        ${query}

        Output:
    `
}
