import React, { SFC } from 'react';
import { Spinner } from '../Spinner/Spinner';

interface LoadingPlaceholderProps {
  text: string;
}

export const LoadingPlaceholder: SFC<LoadingPlaceholderProps> = ({ text }) => (
  <div className="gf-form-group">
    {text} <Spinner inline={true} />
  </div>
);
