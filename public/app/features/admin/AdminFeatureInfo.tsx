import React, { FC } from 'react';
import { FeatureFlagInfo, FeatureToggles } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { useAsync } from 'react-use';
import Page from 'app/core/components/Page/Page';
import { Card, TagList, VerticalGroup, Alert } from '@grafana/ui';

interface FeatureSettings {
  enabled: FeatureToggles;
  info: FeatureFlagInfo[];
  notice?: string[];
}

export const AdminFeatureInfo: FC = () => {
  const { loading, value: features } = useAsync(
    () => getBackendSrv().get('/api/admin/settings/features') as Promise<FeatureSettings>,
    []
  );

  const enabled = features ? features.info.filter((f) => f.enabled) : [];
  const avaliable = features ? features.info.filter((f) => !f.enabled) : [];

  return (
    <Page.Contents isLoading={loading}>
      <div>
        {features?.notice?.length && (
          <VerticalGroup>
            {features.notice.map((m, idx) => (
              <Alert key={idx} severity={'warning'} title={m} />
            ))}
          </VerticalGroup>
        )}

        {enabled.length && (
          <div>
            <h2>Enabled feature flags:</h2>
            {renderFlags(enabled)}
            <br />
          </div>
        )}
        {avaliable.length && (
          <div>
            <h2>Avaliable feature flags:</h2>
            {renderFlags(avaliable)}
          </div>
        )}
      </div>
    </Page.Contents>
  );
};

function renderFlags(features: FeatureFlagInfo[]) {
  return features.map((f) => {
    const tags: string[] = [];
    if (f.modifiesDatabase) {
      tags.push('Modifies database');
    }
    if (f.frontend) {
      tags.push('frontend');
    }
    if (f.requiresEnterprise) {
      tags.push('enterprise');
    }
    if (f.requiresDevMode) {
      tags.push('dev mode');
    }

    tags.push(f.state!);

    return (
      <Card key={f.id} heading={`${f.name} (${f.id})`} description={f.description}>
        <Card.Tags>
          <TagList tags={tags} />
        </Card.Tags>
      </Card>
    );
  });
}
