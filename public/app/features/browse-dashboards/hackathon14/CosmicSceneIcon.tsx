import { css } from "@emotion/css";
import { GrafanaTheme2 } from "@grafana/data";
import { useStyles2 } from "@grafana/ui";

export const CosmicSceneIcon = () => {
    const styles = useStyles2(getContentStyles);
    return (
        <>
                    {/* Cosmic empty state illustration */}
                    <div className={styles.cosmicScene}>
                    <div className={styles.planet}>🪐</div>
                    <div className={styles.star1}>⭐</div>
                    <div className={styles.star2}>✨</div>
                    <div className={styles.star3}>💫</div>
                    <div className={styles.rocket}>🚀</div>
                  </div>
                  </>
    )
}

const getContentStyles = (theme: GrafanaTheme2) => ({
  
    cosmicScene: css({
      position: 'relative',
      width: '200px',
      height: '200px',
      margin: '0 auto',
    }),
  
    planet: css({
      position: 'absolute',
      fontSize: '80px',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      animation: 'spin 20s linear infinite',
      '@keyframes spin': {
        from: { transform: 'translate(-50%, -50%) rotate(0deg)' },
        to: { transform: 'translate(-50%, -50%) rotate(360deg)' },
      },
    }),
  
    star1: css({
      position: 'absolute',
      fontSize: '24px',
      top: '20%',
      left: '15%',
      animation: 'twinkle 2s ease-in-out infinite',
      '@keyframes twinkle': {
        '0%, 100%': { opacity: 1, transform: 'scale(1)' },
        '50%': { opacity: 0.4, transform: 'scale(0.8)' },
      },
    }),
  
    star2: css({
      position: 'absolute',
      fontSize: '20px',
      top: '30%',
      right: '10%',
      animation: 'twinkle 2.5s ease-in-out infinite 0.5s',
    }),
  
    star3: css({
      position: 'absolute',
      fontSize: '22px',
      bottom: '25%',
      left: '20%',
      animation: 'twinkle 3s ease-in-out infinite 1s',
    }),
  
    rocket: css({
      position: 'absolute',
      fontSize: '32px',
      top: '10%',
      right: '20%',
      animation: 'float 4s ease-in-out infinite',
      '@keyframes float': {
        '0%, 100%': { transform: 'translateY(0px) rotate(-15deg)' },
        '50%': { transform: 'translateY(-20px) rotate(-15deg)' },
      },
    }),
  });