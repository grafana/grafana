import React, { SFC } from 'react';
import { Icon } from '../Icon/Icon';

interface LoadingPlaceholderProps {
  text: string;
}

export const LoadingPlaceholder: SFC<LoadingPlaceholderProps> = ({ text }) => (
  <div className="gf-form-group">
    {text} <Icon name="fa fa-spinner" className="fa-spin" />
  </div>
);
