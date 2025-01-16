import {useState} from "react";

import {getCellLinks} from '../../utils';

import {TableCellInspector, TableCellInspectorMode} from "./TableCellInspector";
import {TableCellProps} from './types';


export const InspectableDataLinkCell= (props: TableCellProps) => {
  const { field, row, cellProps, tableStyles } = props;
  const [isInspecting, setIsInspecting] = useState(false);

  const links = getCellLinks(field, row);

  return (
    <div {...cellProps} className={tableStyles.cellContainerText}>
      {links?.length === 0 && (
        <span className={tableStyles.cellText}>{field.values}</span>
        )}
      {links &&
        links.map((link, idx) => {
          return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <span key={idx} className={tableStyles.cellLink} onClick={link.onClick}>
              {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
              <a href="#" onClick={() => {setIsInspecting(true);}} target={link.target}>
                {field.values}
              </a>
            </span>
          );
        })}

      {isInspecting && (
        <TableCellInspector
          mode={TableCellInspectorMode.code}
          value={decodeURI(links?.[0]?.href as string)}
          onDismiss={() => {
            setIsInspecting(false);
          }}
        />
      )}

    </div>
  );
};
