import React from 'react';
import { Flamebearer } from './models/flamebearer';
import { FlamegraphPalette } from './colorPalette';

interface HeaderProps {
  format: Flamebearer['format'];
  units: Flamebearer['units'];

  palette: FlamegraphPalette;
  setPalette: (p: FlamegraphPalette) => void;
  ExportData: () => React.ReactElement;
}
export default function Header(props: HeaderProps) {
  const { format, units, ExportData } = props;

  const unitsToFlamegraphTitle = {
    objects: 'amount of objects in RAM per function',
    bytes: 'amount of RAM per function',
    samples: 'CPU time per function',
  };

  const getTitle = () => {
    switch (format) {
      case 'single': {
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }} role="heading" aria-level={2}>
              {unitsToFlamegraphTitle[units] && <>Frame width represents {unitsToFlamegraphTitle[units]}</>}
            </div>
          </div>
        );
      }

      default:
        throw new Error(`unexpected format ${format}`);
    }
  };

  const title = getTitle();

  return (
    <div style={{ paddingBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>{title}</div>
      <div style={{ display: 'flex', flexShrink: 0 }}>
        <ExportData />
      </div>
    </div>
  );
}
