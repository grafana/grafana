import React, { SFC } from 'react';
import TopSectionItem from './TopSectionItem/TopSectionItem';

interface TopSectionProps {
  mainLinks: any[];
}

const TopSection: SFC<TopSectionProps> = props => {
  return (
    <div className="sidemenu__top">
      {props.mainLinks.map((link, index) => {
        return <TopSectionItem link={link} key={`${link.id}-${index}`} />;
      })}
    </div>
  );
};

export default TopSection;
