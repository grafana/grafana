import { getCellLinks } from '../../../utils';
import { TableCellProps } from '../types';

export const DataLinksCell = (props: TableCellProps) => {
  const { field, row, cellProps, tableStyles } = props;

  const links = getCellLinks(field, row);

  return (
    <div {...cellProps} className={tableStyles.cellContainerText}>
      {links &&
        links.map((link, idx) => {
          return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <span key={idx} className={tableStyles.cellLink} onClick={link.onClick}>
              <a href={link.href} target={link.target}>
                {link.title}
              </a>
            </span>
          );
        })}
    </div>
  );
};
