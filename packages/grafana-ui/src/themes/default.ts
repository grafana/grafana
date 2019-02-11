

const theme = {
  name: 'Grafana Default',
  typography: {
    fontFamily: {
      sansSerif: "'Roboto', Helvetica, Arial, sans-serif;",
      serif: "Georgia, 'Times New Roman', Times, serif;",
      monospace: "Menlo, Monaco, Consolas, 'Courier New', monospace;"
    },
    size: {
      base: '13px',
      xs: '10px',
      s: '12px',
      m: '14px',
      l: '18px',
    },
    heading: {
      h1: '2rem',
      h2: '1.75rem',
      h3: '1.5rem',
      h4: '1.3rem',
      h5: '1.2rem',
      h6: '1rem',
    },
    weight: {
      light: 300,
      normal: 400,
      semibold: 500,
    },
    lineHeight: {
      xs: 1,
      s: 1.1,
      m: 4/3,
      l: 1.5
    }
  },
  brakpoints: {
    xs: '0',
    s: '544px',
    m: '768px',
    l: '992px',
    xl: '1200px'
  },
  spacing: {
    xs: '0',
    s: '0.2rem',
    m: '1rem',
    l: '1.5rem',
    xl: '3rem',
    gutter: '30px',
  },
  border: {
    radius: {
      xs: '2px',
      s: '3px',
      m: '5px',
    }
  }
};

export default theme;
