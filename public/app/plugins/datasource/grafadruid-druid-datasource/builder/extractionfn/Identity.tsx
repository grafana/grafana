import React, { useState } from 'react';
import { InfoBox } from '@grafana/ui';
import { QueryBuilderProps } from '../types';
import { useQueryBuilderAutoSubmit, Row } from '../abstract';

export const Identity = (props: QueryBuilderProps) => {
  useQueryBuilderAutoSubmit(props, Identity);
  const [showInfo, setShowInfo] = useState(true);
  return (
    <>
      {showInfo && (
        <Row>
          <InfoBox
            title="Identity"
            onDismiss={() => {
              setShowInfo(false);
            }}
          >
            <p>Identity. Whatever it does.</p>
          </InfoBox>
        </Row>
      )}
    </>
  );
};
Identity.type = 'identity';
Identity.fields = [] as string[];
