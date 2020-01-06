import React, { PureComponent, FC, ReactNode } from 'react';

export interface Props {
  name: JSX.Element;
  figure?: JSX.Element;
  description?: JSX.Element;
  infoItems?: JSX.Element[];
  actions?: JSX.Element;
  childen?: ReactNode;
}

export class ResourceCard extends PureComponent<Props> {
  render() {
    const { name, figure, description, actions, childen, infoItems } = this.props;

    const figurePart = figure && <div className="resource-card__figure">{figure}</div>;

    const descriptionRow = description && (
      <div className="resource-card__row">
        <div className="resource-card__description">{description}</div>
      </div>
    );

    const infoRow = infoItems && (
      <div className="resource-card__row">
        {React.Children.map(infoItems, (item: JSX.Element) => (
          <div className="resource-card__info-item">{item}</div>
        ))}
      </div>
    );
    const actionParts = actions && <div className="resource-card__actions">{actions}</div>;

    return (
      <div className="resource-card">
        {figure}
        <div className="resource-card__body">
          <div className="resource-card__row">
            <div className="resource-card__name">{name}</div>
          </div>
          {descriptionRow}
          {infoRow}
          {childen}
        </div>
        {actionParts}
      </div>
    );
  }
}

export interface ResourceCardNameProps {
  name: string;
}

export const ResourceCardName: React.FC<ResourceCardNameProps> = ({ name }) => {
  return <div className="resource-card__name">{name}</div>;
};

ResourceCardName.displayName = 'ResourceCardName';
