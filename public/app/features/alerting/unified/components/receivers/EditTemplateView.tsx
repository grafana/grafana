import React, { FC } from 'react';

interface Props {
  templateName: string;
}

export const EditTemplateView: FC<Props> = ({ templateName }) => {
  return <p>@TODO edit template {templateName}</p>;
};
