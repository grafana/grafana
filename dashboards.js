var dashboards = 
{
  title: "Infinite Monkey Dashboard",
  rows: {
    row1: {
      height: "200px",
      panels: {
        "Monkey Productivity": {
          type    : "histogram",
          span    : 8,
          show    : ['lines','points'],
          query   : "*",
          label   : "Monkey lines of shakespeare",
          color   : "#7BA4AF"
        },
        "Works of Shakespeare": {
          type    : "pieterms",
          legend  : true,
          field   : "play_name",
          span    : 4,
          size    : 10,
          query   : "*"
        }
      }
    },
    row2: {
      height: "300px",
      panels: {
        "Royal Decrees": {
          type    : "stackedquery",
          span    : 3,
          donut   : true,
          queries : ['king','queen','duke'],
        },
        "Remote Monkey Activity": {
          type    : "map",
          span    : 6,
          size    : 20,
          field   : 'country',
          query   : '',
          colors  : ['#B07737','#85004B','#7BA4AF'],
        },
        "Main Characters": {
          type    : "pieterms",
          donut   : true,
          legend  : true,
          field   : "country",
          span    : 3,
          size    : 5,
          query   : "*",
        }
      }
    }
  }
};
