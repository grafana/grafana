import React, { FC } from 'react';
import { selectors } from '@grafana/e2e-selectors';

import config from 'app/core/config';
import { Button, LinkButton } from '@grafana/ui';

import { AccessControlAction } from 'app/types/';
import { contextSrv } from 'app/core/core';

export interface Props {
  exploreUrl: string;
  isReadOnly: boolean;
  onDelete: () => void;
  onSubmit: (event: any) => void;
  onTest: (event: any) => void;
}

const ButtonRow: FC<Props> = ({ isReadOnly, onDelete, onSubmit, onTest, exploreUrl }) => {
  const canEditDataSources = !isReadOnly && contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
  const canDeleteDataSources = !isReadOnly && contextSrv.hasPermission(AccessControlAction.DataSourcesDelete);
  const canExploreDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);

  return (
    <div className="gf-form-button-row">
      <LinkButton variant="secondary" fill="solid" href={`${config.appSubUrl}/datasources`}>
        Back
      </LinkButton>
      <LinkButton variant="secondary" fill="solid" href={exploreUrl} disabled={!canExploreDataSources}>
        Explore
      </LinkButton>
      <Button
        type="button"
        variant="destructive"
        disabled={!canDeleteDataSources}
        onClick={onDelete}
        aria-label={selectors.pages.DataSource.delete}
      >
        Delete
      </Button>
      {canEditDataSources && (
        <Button
          type="submit"
          variant="primary"
          disabled={!canEditDataSources}
          onClick={(event) => onSubmit(event)}
          aria-label={selectors.pages.DataSource.saveAndTest}
        >
          Save &amp; test
        </Button>
      )}
      {!canEditDataSources && (
        <Button type="submit" variant="primary" onClick={onTest}>
          Test
        </Button>
      )}
    </div>
  );
};

export default ButtonRow;
