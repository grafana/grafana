import React from 'react';
import { cx } from 'emotion';

export interface CardProps {
  logoUrl?: string;
  title: string;
  description?: string;
  labels?: React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
  errors?: string;
}

export const Card: React.FC<CardProps> = ({
  logoUrl,
  title,
  description,
  labels,
  actions,
  onClick,
  ariaLabel,
  className,
  errors,
}) => {
  const mainClassName = cx('add-data-source-item', className);

  return (
    <div className={mainClassName} onClick={onClick} aria-label={ariaLabel}>
      {logoUrl && <img className="add-data-source-item-logo" src={logoUrl} />}
      <div className="add-data-source-item-text-wrapper">
        <span className="add-data-source-item-text">{title}</span>
        <div>Errors: {errors}</div>
        {description && <span className="add-data-source-item-desc">{description}</span>}
        {labels && <div>{labels}</div>}
      </div>
      {actions && <div className="add-data-source-item-actions">{actions}</div>}
    </div>
  );
};
