import React, { SFC } from 'react';
import SignIn from './SignIn';
import BottomNavLinks from './BottonNavLinks';

interface BottomSectionProps {
  isSignedIn: boolean;
  loginUrl: string;
  bottomNav: any[];
}

const BottomSection: SFC<BottomSectionProps> = props => {
  const { isSignedIn, loginUrl, bottomNav } = props;

  return (
    <div className="sidemenu__bottom">
      {!isSignedIn && <SignIn loginUrl={loginUrl} />}
      {bottomNav.map((link, index) => {
        return <BottomNavLinks link={link} key={`${link.url}-${index}`} />;
      })}
    </div>
  );
};

export default BottomSection;
