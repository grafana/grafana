/**
 * 地图参数
 * key为地图类型: {
 *     getGeoJson: 地图数据加载
 * } 
 */
define(function (require) {
    function decode(json) {
        if (!json.UTF8Encoding) {
            return json;
        }
        var features = json.features;

        for (var f = 0; f < features.length; f++) {
            var feature = features[f];
            var coordinates = feature.geometry.coordinates;
            var encodeOffsets = feature.geometry.encodeOffsets;

            for (var c = 0; c < coordinates.length; c++) {
                var coordinate = coordinates[c];
                
                if (feature.geometry.type === 'Polygon') {
                    coordinates[c] = decodePolygon(
                        coordinate,
                        encodeOffsets[c]
                    );
                } else if (feature.geometry.type === 'MultiPolygon') {
                    for (var c2 = 0; c2 < coordinate.length; c2++) {
                        var polygon = coordinate[c2];
                        coordinate[c2] = decodePolygon(
                            polygon,
                            encodeOffsets[c][c2]
                        );
                    }
                }
            }
        }
        // Has been decoded
        json.UTF8Encoding = false;
        return json;
    }

    function decodePolygon(coordinate, encodeOffsets) {
        var result = [];
        var prevX = encodeOffsets[0];
        var prevY = encodeOffsets[1];

        for (var i = 0; i < coordinate.length; i+=2) {
            var x = coordinate.charCodeAt(i) - 64;
            var y = coordinate.charCodeAt(i+1) - 64;
            // ZigZag decoding
            x = (x >> 1) ^ (-(x & 1));
            y = (y >> 1) ^ (-(y & 1));
            // Delta deocding
            x += prevX;
            y += prevY;

            prevX = x;
            prevY = y;
            // Dequantize
            result.push([x / 1024, y / 1024]);
        }

        return result;
    }

    var mapParams = {
        'none': {
            getGeoJson: function(callback) {
                callback({
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: {
                            coordinates: [],
                            encodeOffsets: [],
                            type: 'Polygon'
                        },
                        properties: {
                            
                        }
                    }]
                });
            }
        },
        // 'world': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/world_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        'china': {
            getGeoJson: function (callback) { 
                require(['./geoJson/china_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '南海诸岛': {
            textCoord: [126, 25],
            getPath: function (leftTop, scale) {
                // scale.x: width  = 10.51 : 64
                var pList = [
                    [
                        [0,3.5],[7,11.2],[15,11.9],[30,7],[42,0.7],[52,0.7],
                        [56,7.7],[59,0.7],[64,0.7],[64,0],[5,0],[0,3.5]
                    ],
                    [
                        [13,16.1],[19,14.7],[16,21.7],[11,23.1],[13,16.1]
                    ],
                    [
                        [12,32.2],[14,38.5],[15,38.5],[13,32.2],[12,32.2]
                    ],
                    [
                        [16,47.6],[12,53.2],[13,53.2],[18,47.6],[16,47.6]
                    ],
                    [
                        [6,64.4],[8,70],[9,70],[8,64.4],[6,64.4]
                    ],
                    [
                        [23,82.6],[29,79.8],[30,79.8],[25,82.6],[23,82.6]
                    ],
                    [
                        [37,70.7],[43,62.3],[44,62.3],[39,70.7],[37,70.7]
                    ],
                    [
                        [48,51.1],[51,45.5],[53,45.5],[50,51.1],[48,51.1]
                    ],
                    [
                        [51,35],[51,28.7],[53,28.7],[53,35],[51,35]
                    ],
                    [
                        [52,22.4],[55,17.5],[56,17.5],[53,22.4],[52,22.4]
                    ],
                    [
                        [58,12.6],[62,7],[63,7],[60,12.6],[58,12.6]
                    ],
                    [
                        [0,3.5],[0,93.1],[64,93.1],[64,0],[63,0],[63,92.4],
                        [1,92.4],[1,3.5],[0,3.5]
                    ]
                ];
                var str = '';
                var left = leftTop[0];
                var top = leftTop[1];
                for (var i = 0, l = pList.length; i < l; i++) {
                    str += 'M ' 
                           + ((pList[i][0][0] * scale+ left).toFixed(2) - 0) 
                           + ' ' 
                           + ((pList[i][0][1] * scale + top).toFixed(2) - 0) 
                           + ' ';
                    for (var j = 1, k = pList[i].length; j < k; j++) {
                        str += 'L ' 
                              + ((pList[i][j][0] * scale + left).toFixed(2) - 0)
                              + ' ' 
                              + ((pList[i][j][1] * scale + top).toFixed(2) - 0)
                              + ' ';
                    }
                }
                return str + ' Z';
            }
        },
<<<<<<< 95874f488acf04b56ea0735ac04ab9f7d20f7d27
        '新疆': {
            getGeoJson: function (callback) { 
                require(['./geoJson/xin_jiang_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
=======
        // '新疆': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/xin_jiang_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
>>>>>>> [OWL-30] Add Echarts map to Grafana
        // '西藏': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/xi_zang_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
<<<<<<< 95874f488acf04b56ea0735ac04ab9f7d20f7d27
        '内蒙古': {
            getGeoJson: function (callback) { 
                require(['./geoJson/nei_meng_gu_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
=======
        // '内蒙古': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/nei_meng_gu_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
>>>>>>> [OWL-30] Add Echarts map to Grafana
        // '青海': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/qing_hai_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
<<<<<<< 95874f488acf04b56ea0735ac04ab9f7d20f7d27
        '四川': {
            getGeoJson: function (callback) { 
                require(['./geoJson/si_chuan_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '黑龙江': {
            getGeoJson: function (callback) { 
                require(['./geoJson/hei_long_jiang_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '甘肃': {
            getGeoJson: function (callback) { 
                require(['./geoJson/gan_su_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '云南': {
            getGeoJson: function (callback) { 
                require(['./geoJson/yun_nan_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '广西': {
            getGeoJson: function (callback) { 
                require(['./geoJson/guang_xi_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '湖南': {
            getGeoJson: function (callback) { 
                require(['./geoJson/hu_nan_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '陕西': {
            getGeoJson: function (callback) { 
                require(['./geoJson/shan_xi_1_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '广东': {
            getGeoJson: function (callback) { 
                require(['./geoJson/guang_dong_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '吉林': {
            getGeoJson: function (callback) { 
                require(['./geoJson/ji_lin_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '河北': {
            getGeoJson: function (callback) { 
                require(['./geoJson/he_bei_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '湖北': {
            getGeoJson: function (callback) { 
                require(['./geoJson/hu_bei_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
=======
        // '四川': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/si_chuan_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '黑龙江': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/hei_long_jiang_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '甘肃': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/gan_su_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '云南': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/yun_nan_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '广西': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/guang_xi_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '湖南': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/hu_nan_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '陕西': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/shan_xi_1_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '广东': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/guang_dong_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '吉林': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/ji_lin_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '河北': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/he_bei_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '湖北': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/hu_bei_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
>>>>>>> [OWL-30] Add Echarts map to Grafana
        // '贵州': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/gui_zhou_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
<<<<<<< 95874f488acf04b56ea0735ac04ab9f7d20f7d27
        '山东': {
            getGeoJson: function (callback) { 
                require(['./geoJson/shan_dong_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '江西': {
            getGeoJson: function (callback) { 
                require(['./geoJson/jiang_xi_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '河南': {
            getGeoJson: function (callback) { 
                require(['./geoJson/he_nan_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '辽宁': {
            getGeoJson: function (callback) { 
                require(['./geoJson/liao_ning_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '山西': {
            getGeoJson: function (callback) { 
                require(['./geoJson/shan_xi_2_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '安徽': {
            getGeoJson: function (callback) { 
                require(['./geoJson/an_hui_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '福建': {
            getGeoJson: function (callback) { 
                require(['./geoJson/fu_jian_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '浙江': {
            getGeoJson: function (callback) { 
                require(['./geoJson/zhe_jiang_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '江苏': {
            getGeoJson: function (callback) { 
                require(['./geoJson/jiang_su_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
=======
        // '山东': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/shan_dong_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '江西': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/jiang_xi_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '河南': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/he_nan_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '辽宁': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/liao_ning_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '山西': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/shan_xi_2_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '安徽': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/an_hui_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '福建': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/fu_jian_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '浙江': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/zhe_jiang_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '江苏': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/jiang_su_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
>>>>>>> [OWL-30] Add Echarts map to Grafana
        // '重庆': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/chong_qing_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
<<<<<<< 95874f488acf04b56ea0735ac04ab9f7d20f7d27
        '宁夏': {
            getGeoJson: function (callback) { 
                require(['./geoJson/ning_xia_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
        '海南': {
            getGeoJson: function (callback) { 
                require(['./geoJson/hai_nan_geo'], function (md){
                    callback(decode(md));
                });
            }
        },
=======
        // '宁夏': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/ning_xia_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '海南': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/hai_nan_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
>>>>>>> [OWL-30] Add Echarts map to Grafana
        // '台湾': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/tai_wan_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '北京': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/bei_jing_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '天津': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/tian_jin_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '上海': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/shang_hai_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '香港': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/xiang_gang_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // },
        // '澳门': {
        //     getGeoJson: function (callback) { 
        //         require(['./geoJson/ao_men_geo'], function (md){
        //             callback(decode(md));
        //         });
        //     }
        // }
    };
    
    return {
        decode: decode,
        params: mapParams
    };
});