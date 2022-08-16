import React, { useState } from 'react';
import { InfoBox } from '@grafana/ui';
import { QueryBuilderProps } from '../types';
import { useQueryBuilderAutoSubmit, Row } from '../abstract';

export const True = (props: QueryBuilderProps) => {
  useQueryBuilderAutoSubmit(props, True);
  const [showInfo, setShowInfo] = useState(true);
  return (
    <>
      {showInfo && (
        <Row>
          <InfoBox
            title="True"
            onDismiss={() => {
              setShowInfo(false);
            }}
          >
            <p>
              The true filter is a filter which matches all values. It can be used to temporarily disable other filters
              without removing the filter.
            </p>
          </InfoBox>
        </Row>
      )}
    </>
  );
};
True.type = 'true';
True.fields = [] as string[];
