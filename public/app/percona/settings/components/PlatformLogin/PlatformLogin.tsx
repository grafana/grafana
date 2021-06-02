import React, { FC, useState } from 'react';
import { useTheme } from '@grafana/ui';
import { getStyles } from './PlatformLogin.styles';
import { SignUpProps } from './types';
import { LoggedIn } from './LoggedIn/LoggedIn';
import { SignIn } from './SignIn/SignIn';
import { SignUp } from './SignUp/SignUp';

export const PlatformLogin: FC<SignUpProps> = ({ userEmail, getSettings }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [isSignInMode, setMode] = useState(true);
  const toggleMode = () => setMode(currentMode => !currentMode);

  return (
    <>
      {userEmail ? (
        <LoggedIn email={userEmail} getSettings={getSettings} />
      ) : (
        <div data-qa="sign-up-form-wrapper" className={styles.formWrapper}>
          {isSignInMode ? (
            <SignIn getSettings={getSettings} changeMode={toggleMode} />
          ) : (
            <SignUp getSettings={getSettings} changeMode={toggleMode} />
          )}
        </div>
      )}
    </>
  );
};
