import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ScalarDimensionConfig } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { DimensionContext } from 'app/features/dimensions/context';
import { ScalarDimensionEditor } from 'app/features/dimensions/editors/ScalarDimensionEditor';

import { CanvasElementItem, CanvasElementOptions, CanvasElementProps, defaultBgColor } from '../element';

interface DroneTopData {
  bRightRotorRPM?: number;
  bLeftRotorRPM?: number;
  fRightRotorRPM?: number;
  fLeftRotorRPM?: number;
  yawAngle?: number;
}

interface DroneTopConfig {
  bRightRotorRPM?: ScalarDimensionConfig;
  bLeftRotorRPM?: ScalarDimensionConfig;
  fRightRotorRPM?: ScalarDimensionConfig;
  fLeftRotorRPM?: ScalarDimensionConfig;
  yawAngle?: ScalarDimensionConfig;
}

const DroneTopDisplay = ({ data }: CanvasElementProps<DroneTopConfig, DroneTopData>) => {
  const styles = useStyles2(getStyles);

  const fRightRotorAnimation = `spin ${data?.fRightRotorRPM ? 60 / Math.abs(data.fRightRotorRPM) : 0}s linear infinite`;

  const fLeftRotorAnimation = `spin ${data?.fLeftRotorRPM ? 60 / Math.abs(data.fLeftRotorRPM) : 0}s linear infinite`;

  const bRightRotorAnimation = `spin ${data?.bRightRotorRPM ? 60 / Math.abs(data.bRightRotorRPM) : 0}s linear infinite`;

  const bLeftRotorAnimation = `spin ${data?.bLeftRotorRPM ? 60 / Math.abs(data.bLeftRotorRPM) : 0}s linear infinite`;

  const droneTopTransformStyle = `rotate(${data?.yawAngle ? data.yawAngle : 0}deg)`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="-43 -43 640 640"
      xmlSpace="preserve"
      style={{ transform: droneTopTransformStyle, fill: defaultBgColor }}
    >
      <path
        fillRule="evenodd"
        d=" M 137.95 127.967 C 137.14 127.157 136.189 126.58 135.178 126.218 C 138.173 121.545 139.967 116.036 140.125 110.123 L 217.64 151.862 C 214.049 157.411 211.8 163.922 211.386 170.95 L 209.694 199.712 L 137.95 127.967 L 137.95 127.967 L 137.95 127.967 L 137.95 127.967 L 137.95 127.967 L 137.95 127.967 L 137.95 127.967 L 137.95 127.967 L 137.95 127.967 Z  M 134.268 426.981 C 130.211 421.314 124.328 417.045 117.482 415.041 L 201.999 330.523 L 201.385 340.955 C 200.67 353.107 202.829 364.914 207.563 375.673 L 134.268 426.981 L 134.268 426.981 L 134.268 426.981 L 134.268 426.981 L 134.268 426.981 L 134.268 426.981 L 134.268 426.981 L 134.268 426.981 Z  M 324.765 373.673 L 228.527 373.673 Q 215.374 358.611 216.361 341.835 L 226.361 171.832 C 226.825 163.94 231.012 157.096 237.146 152.957 L 316.146 152.957 C 322.28 157.096 326.466 163.94 326.931 171.832 L 336.931 341.835 Q 337.918 358.611 324.765 373.673 L 324.765 373.673 L 324.765 373.673 L 324.765 373.673 L 324.765 373.673 L 324.765 373.673 L 324.765 373.673 Z  M 435.81 415.041 C 428.964 417.045 423.081 421.314 419.024 426.981 L 345.727 375.673 C 350.461 364.914 352.62 353.107 351.905 340.955 L 351.291 330.523 L 435.81 415.041 L 435.81 415.041 L 435.81 415.041 L 435.81 415.041 L 435.81 415.041 L 435.81 415.041 Z  M 343.596 199.713 L 341.904 170.951 C 341.49 163.923 339.242 157.411 335.651 151.863 L 413.167 110.124 C 413.325 116.037 415.119 121.546 418.114 126.219 C 417.103 126.581 416.152 127.158 415.342 127.968 L 343.596 199.713 L 343.596 199.713 L 343.596 199.713 L 343.596 199.713 L 343.596 199.713 Z  M 444.646 92.771 C 453.744 92.771 461.146 100.172 461.146 109.271 C 461.146 118.369 453.744 125.771 444.646 125.771 C 435.548 125.771 428.146 118.369 428.146 109.271 C 428.146 100.172 435.548 92.771 444.646 92.771 L 444.646 92.771 L 444.646 92.771 L 444.646 92.771 Z  M 108.647 92.771 C 117.745 92.771 125.147 100.172 125.147 109.271 C 125.147 118.369 117.745 125.771 108.647 125.771 C 99.549 125.771 92.147 118.369 92.147 109.271 C 92.147 100.172 99.549 92.771 108.647 92.771 L 108.647 92.771 L 108.647 92.771 Z  M 108.647 461.771 C 99.549 461.771 92.147 454.369 92.147 445.271 C 92.147 436.172 99.549 428.771 108.647 428.771 C 117.745 428.771 125.147 436.172 125.147 445.271 C 125.147 454.369 117.745 461.771 108.647 461.771 L 108.647 461.771 Z  M 92.322 136.202 C 97.086 139.1 102.675 140.771 108.647 140.771 C 114.883 140.771 120.697 138.941 125.594 135.802 C 125.956 136.813 126.534 137.764 127.343 138.573 L 207.342 218.573 C 207.711 218.942 208.109 219.264 208.528 219.54 L 203.212 309.908 C 201.794 310.182 200.44 310.869 199.342 311.967 L 95.343 415.967 C 94.954 416.356 94.62 416.779 94.335 417.224 C 93.651 417.575 92.976 417.942 92.322 418.34 Q 84.615 424.182 81.716 428.946 C 78.817 433.71 77.147 439.299 77.147 445.271 C 77.147 462.64 91.278 476.771 108.647 476.771 C 114.619 476.771 120.208 475.1 124.972 472.202 C 129.736 469.304 132.678 466.36 135.577 461.596 C 138.476 456.832 140.147 451.243 140.147 445.271 C 140.147 443.943 140.055 442.637 139.895 441.352 L 214.997 388.78 C 217.05 391.677 336.242 391.678 338.295 388.78 L 413.398 441.352 C 413.238 442.637 413.146 443.943 413.146 445.271 C 413.146 451.243 414.817 456.832 417.715 461.596 C 420.613 466.36 423.557 469.304 428.321 472.202 C 433.085 475.1 438.674 476.771 444.646 476.771 C 462.015 476.771 476.146 462.64 476.146 445.271 C 476.146 439.299 474.475 433.71 471.577 428.946 C 468.679 424.182 459.642 417.575 458.958 417.224 C 458.672 416.779 458.339 416.356 457.95 415.967 L 353.95 311.967 C 352.852 310.869 351.498 310.182 350.08 309.908 L 344.764 219.54 C 345.183 219.264 345.581 218.942 345.95 218.573 L 425.95 138.573 C 426.76 137.763 427.337 136.812 427.699 135.802 C 432.596 138.941 438.409 140.771 444.646 140.771 C 450.618 140.771 456.207 139.1 460.971 136.202 C 465.735 133.304 468.679 130.36 471.577 125.596 C 474.475 120.832 476.146 115.243 476.146 109.271 C 476.146 91.903 462.015 77.772 444.646 77.772 C 438.674 77.772 433.085 79.442 428.321 82.34 L 416.215 91.446 L 324.765 140.688 C 318.402 136.324 310.718 133.771 302.473 133.771 L 250.819 133.771 C 242.574 133.771 234.89 136.324 228.527 140.688 L 137.078 91.446 L 124.972 82.34 C 120.208 79.442 114.619 77.772 108.647 77.772 C 91.278 77.772 77.147 91.903 77.147 109.271 C 77.147 115.243 78.818 120.832 81.716 125.595 C 84.614 130.358 87.558 133.304 92.322 136.202 L 92.322 136.202 L 92.322 136.202 L 92.322 136.202 L 92.322 136.202 L 92.322 136.202 L 92.322 136.202 L 92.322 136.202 L 92.322 136.202 Z  M 444.646 461.771 C 435.548 461.771 428.146 454.369 428.146 445.271 C 428.146 436.172 435.548 428.771 444.646 428.771 C 453.744 428.771 461.146 436.172 461.146 445.271 C 461.146 454.369 453.744 461.771 444.646 461.771 Z "
      />
      <path
        fillRule="evenodd"
        d=" M 259.458 334.235 L 259.458 337.211 L 254.514 337.211 L 254.514 350.795 L 250.842 350.795 L 250.842 337.211 L 245.898 337.211 L 245.898 334.235 L 259.458 334.235 Z  M 266.226 347.939 L 272.586 347.939 L 272.754 350.627 L 272.754 350.627 Q 270.498 350.867 265.074 350.867 L 265.074 350.867 L 265.074 350.867 Q 263.418 350.867 262.434 349.967 L 262.434 349.967 L 262.434 349.967 Q 261.45 349.067 261.426 347.531 L 261.426 347.531 L 261.426 337.499 L 261.426 337.499 Q 261.45 335.963 262.434 335.063 L 262.434 335.063 L 262.434 335.063 Q 263.418 334.163 265.074 334.163 L 265.074 334.163 L 265.074 334.163 Q 270.498 334.163 272.754 334.403 L 272.754 334.403 L 272.586 337.115 L 266.226 337.115 L 266.226 337.115 Q 265.626 337.115 265.362 337.403 L 265.362 337.403 L 265.362 337.403 Q 265.098 337.691 265.098 338.339 L 265.098 338.339 L 265.098 340.859 L 271.698 340.859 L 271.698 343.499 L 265.098 343.499 L 265.098 346.691 L 265.098 346.691 Q 265.098 347.363 265.362 347.651 L 265.362 347.651 L 265.362 347.651 Q 265.626 347.939 266.226 347.939 L 266.226 347.939 Z  M 275.202 333.995 L 278.73 333.995 L 278.73 346.931 L 278.73 346.931 Q 278.73 348.131 280.074 348.131 L 280.074 348.131 L 281.034 348.131 L 281.442 350.603 L 281.442 350.603 Q 280.53 351.083 278.61 351.083 L 278.61 351.083 L 278.61 351.083 Q 277.026 351.083 276.114 350.231 L 276.114 350.231 L 276.114 350.231 Q 275.202 349.379 275.202 347.819 L 275.202 347.819 L 275.202 333.995 Z  M 283.05 333.995 L 286.578 333.995 L 286.578 346.931 L 286.578 346.931 Q 286.578 348.131 287.922 348.131 L 287.922 348.131 L 288.882 348.131 L 289.29 350.603 L 289.29 350.603 Q 288.378 351.083 286.458 351.083 L 286.458 351.083 L 286.458 351.083 Q 284.874 351.083 283.962 350.231 L 283.962 350.231 L 283.962 350.231 Q 283.05 349.379 283.05 347.819 L 283.05 347.819 L 283.05 333.995 Z  M 292.086 335.759 L 292.086 335.759 L 292.086 335.759 Q 293.634 333.923 297.618 333.923 L 297.618 333.923 L 297.618 333.923 Q 301.602 333.923 303.162 335.759 L 303.162 335.759 L 303.162 335.759 Q 304.722 337.595 304.722 342.515 L 304.722 342.515 L 304.722 342.515 Q 304.722 347.435 303.162 349.271 L 303.162 349.271 L 303.162 349.271 Q 301.602 351.107 297.618 351.107 L 297.618 351.107 L 297.618 351.107 Q 293.634 351.107 292.086 349.271 L 292.086 349.271 L 292.086 349.271 Q 290.538 347.435 290.538 342.515 L 290.538 342.515 L 290.538 342.515 Q 290.538 337.595 292.086 335.759 Z  M 300.174 338.051 L 300.174 338.051 L 300.174 338.051 Q 299.49 336.875 297.618 336.875 L 297.618 336.875 L 297.618 336.875 Q 295.746 336.875 295.062 338.051 L 295.062 338.051 L 295.062 338.051 Q 294.378 339.227 294.378 342.515 L 294.378 342.515 L 294.378 342.515 Q 294.378 345.803 295.062 346.979 L 295.062 346.979 L 295.062 346.979 Q 295.746 348.155 297.618 348.155 L 297.618 348.155 L 297.618 348.155 Q 299.49 348.155 300.174 346.979 L 300.174 346.979 L 300.174 346.979 Q 300.858 345.803 300.858 342.515 L 300.858 342.515 L 300.858 342.515 Q 300.858 339.227 300.174 338.051 Z "
      />
      <g className="propeller-group">
        <path
          className={`${styles.propeller} ${styles.propellerCW}`}
          style={{ animation: bRightRotorAnimation }}
          d=" M 461.563 418.77 L 463.992 416.34 Q 465.495 407.116 466.461 400.395 C 467.426 393.675 469.363 388.087 474.731 383.284 Q 533.862 341.514 538.196 338.859 C 542.529 336.203 548.345 334.299 551.492 338.29 C 554.639 342.282 553.481 346.02 549.419 350.082 L 471.147 428.354 L 461.563 418.77 Z  M 427.729 471.772 L 425.299 474.202 Q 423.797 483.426 422.831 490.146 C 421.866 496.867 419.929 502.454 414.561 507.257 Q 355.43 549.028 351.096 551.683 C 346.763 554.338 340.947 556.243 337.8 552.251 C 334.653 548.26 335.811 544.522 339.873 540.46 L 418.145 462.187 L 427.729 471.772 Z "
        />
        <path
          className={`${styles.propeller} ${styles.propellerCCW}`}
          style={{ animation: fRightRotorAnimation }}
          d=" M 461.563 135.773 L 463.992 138.203 Q 465.495 147.426 466.461 154.147 C 467.426 160.868 469.363 166.455 474.731 171.258 Q 533.862 213.028 538.196 215.684 C 542.529 218.339 548.345 220.244 551.492 216.252 C 554.639 212.26 553.481 208.523 549.419 204.46 L 471.147 126.188 L 461.563 135.773 Z  M 427.729 82.77 L 425.299 80.34 Q 423.797 71.117 422.831 64.396 C 421.866 57.675 419.929 52.088 414.561 47.285 Q 355.43 5.515 351.096 2.859 C 346.763 0.204 340.947 -1.701 337.8 2.291 C 334.653 6.282 335.811 10.02 339.873 14.082 L 418.145 92.355 L 427.729 82.77 Z "
        />
        <path
          className={`${styles.propeller} ${styles.propellerCCW}`}
          style={{ animation: bLeftRotorAnimation }}
          d=" M 125.563 471.772 L 127.993 474.202 Q 129.496 483.426 130.461 490.146 C 131.427 496.867 133.363 502.454 138.731 507.257 Q 197.863 549.028 202.196 551.683 C 206.53 554.338 212.345 556.243 215.492 552.251 C 218.639 548.26 217.482 544.522 213.419 540.46 L 135.148 462.187 L 125.563 471.772 Z  M 91.73 418.77 L 89.3 416.34 Q 87.797 407.116 86.832 400.395 C 85.866 393.675 83.93 388.087 78.562 383.284 Q 19.431 341.514 15.097 338.859 C 10.763 336.203 4.948 334.299 1.801 338.29 C -1.346 342.282 -0.189 346.02 3.874 350.082 L 82.146 428.354 L 91.73 418.77 Z "
        />
        <path
          className={`${styles.propeller} ${styles.propellerCW}`}
          style={{ animation: fLeftRotorAnimation }}
          d=" M 125.563 82.77 L 127.993 80.34 Q 129.496 71.117 130.461 64.396 C 131.427 57.675 133.363 52.088 138.731 47.285 Q 197.863 5.515 202.196 2.859 C 206.53 0.204 212.345 -1.701 215.492 2.291 C 218.639 6.282 217.482 10.02 213.419 14.083 L 135.147 92.355 L 125.563 82.77 Z  M 91.73 135.773 L 89.3 138.203 Q 87.797 147.426 86.832 154.147 C 85.866 160.868 83.93 166.455 78.562 171.258 Q 19.431 213.028 15.097 215.684 C 10.763 218.339 4.948 220.243 1.801 216.252 C -1.346 212.26 -0.189 208.523 3.874 204.46 L 82.146 126.188 L 91.73 135.773 Z "
        />
      </g>
    </svg>
  );
};

export const droneTopItem: CanvasElementItem = {
  id: 'droneTop',
  name: 'Drone Top',
  description: 'Drone top',

  display: DroneTopDisplay,

  defaultSize: {
    width: 100,
    height: 100,
  },

  getNewOptions: (options) => ({
    ...options,
    background: {
      color: {
        fixed: 'transparent',
      },
    },
    links: options?.links ?? [],
  }),

  // Called when data changes
  prepareData: (dimensionContext: DimensionContext, elementOptions: CanvasElementOptions<DroneTopConfig>) => {
    const droneTopConfig = elementOptions.config;

    const data: DroneTopData = {
      bRightRotorRPM: droneTopConfig?.bRightRotorRPM
        ? dimensionContext.getScalar(droneTopConfig.bRightRotorRPM).value()
        : 0,
      bLeftRotorRPM: droneTopConfig?.bLeftRotorRPM
        ? dimensionContext.getScalar(droneTopConfig.bLeftRotorRPM).value()
        : 0,
      fRightRotorRPM: droneTopConfig?.fRightRotorRPM
        ? dimensionContext.getScalar(droneTopConfig.fRightRotorRPM).value()
        : 0,
      fLeftRotorRPM: droneTopConfig?.fLeftRotorRPM
        ? dimensionContext.getScalar(droneTopConfig.fLeftRotorRPM).value()
        : 0,
      yawAngle: droneTopConfig?.yawAngle ? dimensionContext.getScalar(droneTopConfig.yawAngle).value() : 0,
    };

    return data;
  },

  registerOptionsUI: (builder) => {
    const category = [t('canvas.drone-top-item.category-drone-top', 'Drone Top')];
    builder
      .addCustomEditor({
        category,
        id: 'yawAngle',
        path: 'config.yawAngle',
        name: t('canvas.drone-top-item.name-yaw-angle', 'Yaw Angle'),
        editor: ScalarDimensionEditor,
      })
      .addCustomEditor({
        category,
        id: 'fRightRotorRPM',
        path: 'config.fRightRotorRPM',
        name: t('canvas.drone-top-item.name-front-right-rotor-rpm', 'Front Right Rotor RPM'),
        editor: ScalarDimensionEditor,
      })
      .addCustomEditor({
        category,
        id: 'fLeftRotorRPM',
        path: 'config.fLeftRotorRPM',
        name: t('canvas.drone-top-item.name-front-left-rotor-rpm', 'Front Left Rotor RPM'),
        editor: ScalarDimensionEditor,
      })
      .addCustomEditor({
        category,
        id: 'bRightRotorRPM',
        path: 'config.bRightRotorRPM',
        name: t('canvas.drone-top-item.name-back-right-rotor-rpm', 'Back Right Rotor RPM'),
        editor: ScalarDimensionEditor,
      })
      .addCustomEditor({
        category,
        id: 'bLeftRotorRPM',
        path: 'config.bLeftRotorRPM',
        name: t('canvas.drone-top-item.name-back-left-rotor-rpm', 'Back Left Rotor RPM'),
        editor: ScalarDimensionEditor,
      });
  },
};

const getStyles = (theme: GrafanaTheme2) => ({
  propeller: css({
    transformOrigin: '50% 50%',
    transformBox: 'fill-box',
    display: 'block',
    '@keyframes spin': {
      from: {
        transform: 'rotate(0deg)',
      },
      to: {
        transform: 'rotate(360deg)',
      },
    },
  }),
  propellerCW: css({
    // TODO: figure out what styles to apply when prefers-reduced-motion is set
    // eslint-disable-next-line @grafana/no-unreduced-motion
    animationDirection: 'normal',
  }),
  propellerCCW: css({
    // TODO: figure out what styles to apply when prefers-reduced-motion is set
    // eslint-disable-next-line @grafana/no-unreduced-motion
    animationDirection: 'reverse',
  }),
});
