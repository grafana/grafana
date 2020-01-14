import React, { FunctionComponent, ReactNode } from 'react';

export interface Props {
  resourceName: string;
  imageUrl?: string;
  description?: string;
  url?: string;
  type?: string;
  isDefault?: boolean;
  actions?: ReactNode;
}

const ResourceCardBase: FunctionComponent<Props> = props => {
  const { resourceName, imageUrl, description, url, type, isDefault, actions } = props;

  return (
    <div className="resource-card">
      {imageUrl && <img className="resource-card-logo" src={imageUrl} alt={resourceName} />}
      <div className="resource-card-text-wrapper">
        <span className="resource-card-text">
          {resourceName}
          {isDefault && (
            <>
              &nbsp;<span className="btn btn-secondary btn-mini">default</span>
            </>
          )}
        </span>
        {description && <span className="resource-card-desc">{description}</span>}
        {(type || url) && (
          <span className="resource-card-desc">
            {type && <>Type:&nbsp;{type}</>}
            {type && url && ' | '}
            {url && <>URL:&nbsp;{url}</>}
          </span>
        )}
      </div>
      {actions && <div className="resource-card-actions">{actions}</div>}
    </div>
  );
};

export const ResourceCard = ResourceCardBase;
