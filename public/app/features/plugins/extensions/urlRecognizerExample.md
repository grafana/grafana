# URL Recognizer Extension Example

This example demonstrates how to use the URL recognizer extension system in Grafana.

## Plugin Implementation

### 1. Register a URL Recognizer in Your App Plugin

```typescript
// In your plugin's module.ts or plugin.ts file
import { AppPlugin, UrlMetadata } from '@grafana/data';

// Define your custom metadata type
interface IncidentMetadata {
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  assignee?: string;
  createdAt?: string;
}

export const plugin = new AppPlugin<{}>().addUrlRecognizer<IncidentMetadata>({
  title: 'Incident',
  description: 'Recognizes incident URLs from our incident management system',
  recognizer: async (url: string) => {
    // Check if URL matches your pattern
    if (!url.includes('incidents.example.com')) {
      return null;
    }

    try {
      const urlObj = new URL(url);
      const incidentId = urlObj.pathname.match(/\/incident\/([^/]+)/)?.[1];

      if (!incidentId) {
        return null;
      }

      // You could fetch additional metadata from your API here
      // const metadata = await fetch(`/api/incidents/${incidentId}`);

      // The return type is now strongly typed
      return {
        id: incidentId,
        title: `Incident #${incidentId}`,
        description: 'Critical production incident',
        severity: 'high',
        status: 'investigating',
        assignee: 'john.doe@example.com',
        createdAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },
  schema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
      status: { type: 'string' },
      assignee: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'title', 'severity', 'status'],
  },
});
```

### 2. Multiple Recognizers with Different Types

```typescript
interface GitHubPRMetadata {
  owner: string;
  repo: string;
  prNumber: number;
}

interface JiraIssueMetadata {
  type: 'jira-issue';
  project?: string;
}

export const plugin = new AppPlugin<{}>()
  .addUrlRecognizer<GitHubPRMetadata>({
    title: 'GitHub PR',
    description: 'Recognizes GitHub pull request URLs',
    recognizer: async (url: string) => {
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
      if (!match) return null;

      const [, owner, repo, prNumber] = match;
      return {
        id: `${owner}/${repo}#${prNumber}`,
        title: `PR #${prNumber}`,
        description: `Pull request in ${owner}/${repo}`,
        owner,
        repo,
        prNumber: parseInt(prNumber, 10),
      };
    },
  })
  .addUrlRecognizer<JiraIssueMetadata>({
    title: 'Jira Issue',
    description: 'Recognizes Jira issue URLs',
    recognizer: async (url: string) => {
      const match = url.match(/jira\..*\/browse\/([A-Z]+-\d+)/);
      if (!match) return null;

      const issueKey = match[1];
      const project = issueKey.split('-')[0];
      return {
        id: issueKey,
        title: issueKey,
        description: 'Jira issue',
        type: 'jira-issue',
        project,
      };
    },
  });
```

## Using the URL Metadata API

### In a React Component

```typescript
import React, { useEffect, useState } from 'react';
import { getUrlMetadata } from '@grafana/runtime';

interface UrlCardProps {
  url: string;
}

export const UrlCard: React.FC<UrlCardProps> = ({ url }) => {
  const [metadata, setMetadata] = useState<Array<{ pluginId: string; metadata: any }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const results = await getUrlMetadata({ url });
        setMetadata(results);
      } catch (error) {
        console.error('Failed to fetch URL metadata:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [url]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (metadata.length === 0) {
    // Fallback to simple link
    return <a href={url}>{url}</a>;
  }

  // Render rich cards for recognized URLs
  return (
    <div>
      {metadata.map((result, index) => (
        <div key={index} className="url-card">
          <h4>{result.metadata.title}</h4>
          <p>{result.metadata.description}</p>
          <small>Recognized by: {result.pluginId}</small>
          {/* Render additional metadata based on type */}
          {result.metadata.type === 'dashboard' && (
            <a href={`/d/${result.metadata.uid}`}>Open Dashboard</a>
          )}
        </div>
      ))}
    </div>
  );
};
```

### In a Panel Plugin

```typescript
import { PanelPlugin } from '@grafana/data';
import { getUrlMetadata } from '@grafana/runtime';

export const plugin = new PanelPlugin(MyPanel).setPanelOptions((builder) => {
  builder.addTextInput({
    path: 'url',
    name: 'Resource URL',
    description: 'URL to analyze',
    defaultValue: '',
  });
});

// In your panel component
const MyPanel: React.FC<Props> = ({ options }) => {
  const [urlInfo, setUrlInfo] = useState(null);

  useEffect(() => {
    if (options.url) {
      getUrlMetadata({ url: options.url }).then((results) => {
        if (results.length > 0) {
          // Use the first matching recognizer
          setUrlInfo(results[0]);
        }
      });
    }
  }, [options.url]);

  // Render based on URL metadata...
};
```

## Built-in Grafana Recognizers

Grafana comes with built-in recognizers for:

1. **Dashboards** - Recognizes `/d/{uid}/{slug}` URLs
2. **Explore** - Recognizes `/explore` URLs with datasource context
3. **Alerts** - Recognizes `/alerting/rule/{uid}` URLs

These return metadata with `pluginId: 'grafana'`.

## Testing Your Recognizer

```typescript
// In your test file
import { getUrlMetadata } from '@grafana/runtime';

describe('URL Recognizer', () => {
  it('should recognize incident URLs', async () => {
    const results = await getUrlMetadata({
      url: 'https://incidents.example.com/incident/INC-12345',
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      pluginId: 'my-incident-plugin',
      metadata: {
        id: 'INC-12345',
        title: 'Incident #INC-12345',
        description: expect.any(String),
        severity: expect.any(String),
        status: expect.any(String),
      },
    });
  });

  it('should return empty array for unrecognized URLs', async () => {
    const results = await getUrlMetadata({
      url: 'https://unknown.example.com/page',
    });

    expect(results).toEqual([]);
  });
});
```

## Best Practices

1. **Performance**: Keep recognizers fast - they run on every URL
2. **Specificity**: Check URL patterns early to return `null` quickly for non-matches
3. **Error Handling**: Always wrap URL parsing in try-catch blocks
4. **Caching**: Consider caching metadata for expensive operations
5. **Schema**: Provide a JSON schema to document your metadata structure
6. **Multiple Matches**: Remember that multiple plugins can recognize the same URL

## Use Cases

- **Incident Management**: Display incident details inline when URLs are shared
- **Monitoring**: Show SLO or alert status for linked resources
- **Documentation**: Enrich links to docs with previews or status
- **Integration**: Connect external tools by recognizing their URLs
- **Collaboration**: Provide context when team members share links
