export const themeSetting: { [key: string]: string } = {
  light: `
        .navBar {
            background: transparent;
        }
        
        .theme-panel-container {
            border-radius: 8px;
            border: 1px solid var(--color-white, #FFF);
            background: rgba(255, 255, 255, 0.50);
            -webkit-backdrop-filter: blur(15px);
            backdrop-filter: blur(15px);
        }
        
        .main-view {
            background: url("./public/themeSetting/img/light1.jpg") no-repeat center center fixed;
            -webkit-background-size: cover;
            -moz-background-size: cover;
            -o-background-size: cover;
            -webkit-background-size: cover;
            background-size: cover;
        }
        `,
  dark: `
        .navBar {
            background: transparent;
        }
        .theme-panel-container {
            border-radius: 8px;
            background: rgba(0, 0, 0, 0.50);
            -webkit-backdrop-filter: blur(3px);
            -webkit-backdrop-filter: blur(3px);
            backdrop-filter: blur(3px);
        }
        
        .main-view {
            background: url("./public/themeSetting/img/dark1.jpg") no-repeat center center fixed;
            -webkit-background-size: cover;
            -moz-background-size: cover;
            -o-background-size: cover;
            -webkit-background-size: cover;
            background-size: cover;
        }
    `,
};
