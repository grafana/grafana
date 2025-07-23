import { DataLinksCellProps } from '../types';
import { getCellLinks } from '../utils';

export const DataLinksCell = ({ field, rowIdx }: DataLinksCellProps) => {
  const links = getCellLinks(field, rowIdx);

  if (!links?.length) {
    return null;
  }

  return links.map((link, idx) =>
    !link.href && link.onClick == null ? (
      <span key={idx}>{link.title}</span>
    ) : (
      <a key={idx} onClick={link.onClick} href={link.href} target={link.target}>
        {link.title}
      </a>
    )
  );
};
