import React, { SFC } from 'react';
import SignIn from './SignIn/SignIn';
import BottomNavLinks from './BottomNavLinks/BottonNavLinks';

interface BottomSectionProps {
  isSignedIn: boolean;
  loginUrl: string;
  bottomNav: any[];
  itemClicked: (event, item) => void;
}

const BottomSection: SFC<BottomSectionProps> = props => {
  const { isSignedIn, loginUrl, bottomNav, itemClicked } = props;

  return (
    <div className="sidemenu__bottom">
      {!isSignedIn && <SignIn loginUrl={loginUrl} />}
      {bottomNav.map((link, index) => {
        return <BottomNavLinks link={link} key={`${link.url}-${index}`} itemClicked={itemClicked} />;
      })}
    </div>
  );
};

export default BottomSection;
