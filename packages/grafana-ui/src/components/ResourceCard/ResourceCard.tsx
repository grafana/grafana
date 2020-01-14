import React, { PureComponent, FunctionComponent, ReactNode } from 'react';

export interface ResourceCardNameProps {
  value: string;
}

export const ResourceCardName: FunctionComponent<ResourceCardNameProps> = ({ value }) => {
  return <span className="resource-card-text">{value}</span>;
};

export interface ResourceCardDescriptionProps {
  value: string;
}

export const ResourceCardDescription: FunctionComponent<ResourceCardDescriptionProps> = ({ value }) => {
  return <span className="resource-card-desc">{value}</span>;
};

export interface ResourceCardFigureProps {
  src: string;
  alt: string;
}

export const ResourceCardFigure: FunctionComponent<ResourceCardFigureProps> = ({ src, alt }) => {
  return <img className="resource-card-logo" src={src} alt={alt} />;
};

export interface ResourceCardInfoItemProps {
  keyName: string;
  value: string;
}

export const ResourceCardInfoItem: FunctionComponent<ResourceCardInfoItemProps> = ({ keyName, value }) => {
  return keyName && value ? (
    <span className="resource-card-desc">
      {keyName}: {value}
    </span>
  ) : null;
};

export interface ResourceCardActionsProps {
  actions: JSX.Element[];
}

export const ResourceCardActions: FunctionComponent<ResourceCardActionsProps> = ({ actions }) => {
  return <div className="resource-card-actions">{React.Children.map(actions, (action: JSX.Element) => action)}</div>;
};

export interface Props {
  name: JSX.Element;
  description?: JSX.Element;
  figure?: JSX.Element;
  infoItems?: JSX.Element[];
  actions?: JSX.Element[];
  children?: ReactNode;
}

export class ResourceCard extends PureComponent<Props> {
  static Name = ResourceCardName;
  static Description = ResourceCardDescription;
  static Figure = ResourceCardFigure;
  static InfoItem = ResourceCardInfoItem;
  static Actions = ResourceCardActions;

  render() {
    const { name, description, figure, infoItems, actions, children } = this.props;

    return (
      <div className="resource-card">
        {figure}
        <div className="resource-card-text-wrapper">
          {name}
          {description}
          {infoItems}
          {children}
        </div>
        {actions && <ResourceCardActions actions={actions} />}
      </div>
    );
  }
}
