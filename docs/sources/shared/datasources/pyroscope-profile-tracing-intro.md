---
headless: true
labels:
  products:
    - enterprise
    - oss
---

[//]: # 'This file documents the introductory material for traces to profiling for the Pyroscope data source.'
[//]: # 'This shared file is included in these locations:'
[//]: # '/grafana/docs/sources/datasources/pyroscope/profiling-and-tracing.md'
[//]: # '/website/docs/grafana-cloud/data-configuration/traces/traces-query-editor.md'
[//]: # '/docs/sources/view-and-analyze-profile-data/profile-tracing/_index.md'
[//]: #
[//]: # 'If you make changes to this file, verify that the meaning and content are not changed in any place where the file is included.'
[//]: # 'Any links should be fully qualified and not relative: /docs/grafana/ instead of ../grafana/.'

<!-- Profiling and tracing integration -->

Profiles, continuous profiling, and distributed traces are all tools that can be used to improve the performance and reliability of applications.
However, each tool has its own strengths and weaknesses, and it is important to choose the right tool for the job as well as understand when to use both.

## Profiling

Profiling offers a deep-dive into an application's performance at the code level, highlighting resource usage and performance hotspots.

<table>
  <tr>
    <th scope="row">Usage</th>
    <td>During development, major releases, or upon noticing performance quirks.</td>
  </tr>
  <tr>
    <th scope="row">Benefits</th>
    <td>
      <ul>
        <li>Business: Boosts user experience through enhanced application performance.</li>
        <li>Technical: Gives clear insights into code performance and areas of refinement.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <th scope="row">Example</th>
    <td>A developer uses profiling upon noting slow app performance, identifies a CPU-heavy function, and optimizes it.</td>
  </tr>
</table>

## Continuous profiling

Continuous profiling provides ongoing performance insights, capturing long-term trends and intermittent issues.

<table>
  <tr>
    <th scope="row">Usage</th>
    <td>Mainly in production, especially for high-priority applications.</td>
  </tr>
  <tr>
    <th scope="row">Benefits</th>
    <td>
      <ul>
        <li>Business: Preemptively addresses inefficiencies, potentially saving costs.</li>
        <li>Technical: Highlights performance trends and issues like potential memory leaks over time.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <th scope="row">Example</th>
    <td>A month-long data from continuous profiling suggests increasing memory consumption, hinting at a memory leak.</td>
  </tr>
</table>

## Distributed tracing

Traces requests as they cross multiple services, revealing interactions and service dependencies.

<table>
  <tr>
    <th scope="row">Usage</th>
    <td>Essential for systems like microservices where requests touch multiple services.</td>
  </tr>
  <tr>
    <th scope="row">Benefits</th>
    <td>
      <ul>
        <li>Business: Faster issue resolution, reduced downtimes, and strengthened customer trust.</li>
        <li>Technical: A broad view of the system's structure, revealing bottlenecks and inter-service dependencies.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <th scope="row">Example</th>
    <td>In e-commerce, a user's checkout request might involve various services. Tracing depicts this route, pinpointing where time is most spent.</td>
  </tr>
</table>

## Combined power of tracing and profiling

When used together, tracing and profiling provide a powerful tool for understanding system and application performance.

<table>
  <tr>
    <th scope="row">Usage</th>
    <td>For comprehensive system-to-code insights, especially when diagnosing complex issues spread across services and codebases.</td>
  </tr>
  <tr>
    <th scope="row">Benefits</th>
    <td>
      <ul>
        <li>Business: Reduces downtime, optimizes user experience, and safeguards revenues.</li>
        <li>Technical:
          <ul>
            <li>Holistic view: Tracing pinpoints bottle-necked services, while profiling delves into the responsible code segments.</li>
            <li>End-to-end insight: Visualizes a request's full journey and the performance of individual code parts.</li>
            <li>Efficient diagnosis: Tracing identifies service latency; profiling zeroes in on its cause, be it database queries, API calls, or specific code inefficiencies.</li>
          </ul>
        </li>
      </ul>
    </td>
  </tr>
  <tr>
    <th scope="row">Example</th>
    <td>Tracing reveals latency in a payment service. Combined with profiling, it's found that a particular function, making third-party validation calls, is the culprit. This insight guides optimization, refining system efficiency.</td>
  </tr>
</table>
