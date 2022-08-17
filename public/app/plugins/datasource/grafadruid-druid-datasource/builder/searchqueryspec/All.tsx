import React, { useState } from 'react';
import { InfoBox } from '@grafana/ui';
import { QueryBuilderProps } from '../types';
import { useQueryBuilderAutoSubmit, Row } from '../abstract';

export const All = (props: QueryBuilderProps) => {
  useQueryBuilderAutoSubmit(props, All);
  const [showInfo, setShowInfo] = useState(true);
  return (
    <>
      {showInfo && (
        <Row>
          <InfoBox
            title="All"
            onDismiss={() => {
              setShowInfo(false);
            }}
          >
            <p>All. Whatever it does.</p>
          </InfoBox>
        </Row>
      )}
    </>
  );
};
All.type = 'all';
All.fields = [] as string[];
